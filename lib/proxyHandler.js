/**
 * Proxy Handler Module - With enhanced logging and timeouts
 * 
 * Handles proxy requests for subdomains.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { tokenStore } = require('./tokenStore');
const { renderErrorPage } = require('./utils');
const { createResponseRewriter } = require('./linkRewriter');
const config = require('../config');

// Cache pour éviter de vérifier le token pour chaque ressource de la même page
const requestCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 secondes

/**
 * Creates a proxy middleware for a target domain
 * 
 * @param {object} targetInfo - Target domain information
 * @param {string} token - Token used for this proxy request
 * @returns {function} - Configured proxy middleware
 */
function createProxyMiddleware2(targetInfo, token) {
  if (!targetInfo || !targetInfo.domain) {
    throw new Error('Invalid target info: missing domain');
  }
  
  return createProxyMiddleware({
    target: `${targetInfo.protocol}://${targetInfo.domain}`,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    selfHandleResponse: false, // Enable response handling for link rewriting
    timeout: 20000, // Set a reasonable timeout (20 seconds)
    proxyTimeout: 20000, // Same for proxy timeout
    
    onProxyReq: (proxyReq, req, res) => {
      // Store token in request object for the response handler
      req.proxyToken = token;
      
      // Set standard headers
      proxyReq.setHeader('User-Agent', config.USER_AGENT || 'Mozilla/5.0 ProxyWarp/1.0');
      proxyReq.setHeader('Referer', `${targetInfo.protocol}://${targetInfo.domain}/`);
      proxyReq.setHeader('Host', targetInfo.domain);
      
      // Remove proxy-specific headers
      proxyReq.removeHeader('x-forwarded-host');
      proxyReq.removeHeader('x-forwarded-proto');
      
      // Start a timer to track request time
      req._proxyStart = Date.now();
      
      if (config.DEBUG) {
        console.log(`[${Date.now()}] Proxy request started: ${req.method} ${req.path} -> ${targetInfo.domain} (token: ${token})`);
        // Log all headers being sent
        console.log(`Request headers sent to ${targetInfo.domain}:`, proxyReq._headers);
      }
    },
    
    onProxyRes: (proxyRes, req, res) => {
      // Calculate request time
      const requestTime = Date.now() - (req._proxyStart || Date.now());
      
      // First handle security headers
      // Remove security headers that prevent embedding
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['X-Frame-Options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['Content-Security-Policy'];
      delete proxyRes.headers['content-security-policy-report-only'];
      delete proxyRes.headers['feature-policy'];
      delete proxyRes.headers['permissions-policy'];

      
      // Add permissive CORS headers
      proxyRes.headers['access-control-allow-origin'] = '*';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      

      proxyRes.headers['x-frame-options'] = 'ALLOWALL';
      
      if (config.DEBUG) {
        console.log(`[${Date.now()}] Proxy response received: ${req.method} ${req.path} -> ${proxyRes.statusCode} (time: ${requestTime}ms)`);
        console.log(`Response headers from ${targetInfo.domain}:`, proxyRes.headers);
      }
      
      // Apply response rewriter for HTML content
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        if (config.DEBUG) {
          console.log(`Rewriting HTML content for ${req.path}`);
        }
        
        const responseRewriter = createResponseRewriter(targetInfo);
        const handled = responseRewriter(proxyRes, req, res);
        
        if (!handled) {
          if (config.DEBUG) {
            console.log(`HTML rewriter didn't handle the response, piping directly`);
          }
          proxyRes.pipe(res);
        }
      } else {
        // For non-HTML content, just pipe the response
        if (config.DEBUG) {
          console.log(`Passing through non-HTML content (${contentType}) for ${req.path}`);
        }
        proxyRes.pipe(res);
      }
    },
    
    // Error handling with detailed logging
    onError: (err, req, res) => {
      const requestTime = Date.now() - (req._proxyStart || Date.now());
      
      console.error(`[${Date.now()}] Proxy error after ${requestTime}ms: ${req.method} ${req.path} -> ${err.message}`);
      console.error('Error details:', err);
      console.error('Request headers:', req.headers);
      
      if (!res.headersSent) {
        try {
          res.status(502).send(renderErrorPage('Proxy Error', 
            'An error occurred while connecting to the requested site.',
            `Error: ${err.message}\nTime: ${requestTime}ms\nTarget: ${targetInfo.domain}`));
        } catch (responseError) {
          console.error('Failed to send error page:', responseError);
        }
      } else {
        console.warn('Headers already sent, cannot send error page');
        // Try to end the response if possible
        try {
          res.end();
        } catch (endError) {
          console.error('Failed to end response:', endError);
        }
      }
    }
  });
}

/**
 * Setup proxy handler middleware
 * 
 * @param {object} app - Express application
 */
function setupProxyHandler(app) {
  app.use((req, res, next) => {
    const host = req.headers.host;
    
    if (config.DEBUG) {
      console.log(`[${Date.now()}] Request host: ${host}, BASE_DOMAIN: ${config.BASE_DOMAIN}`);
    }
    
    // Skip non-subdomain requests
    if (!host || host === config.BASE_DOMAIN || !host.endsWith(`.${config.BASE_DOMAIN}`)) {
      return next();
    }
    
    // Get token from subdomain
    const token = host.replace(`.${config.BASE_DOMAIN}`, '');
    
    if (config.DEBUG) {
      console.log(`[${Date.now()}] Processing subdomain request with token: ${token}`);
    }
    
    // Add request timeout to prevent hanging requests
    const requestTimeout = setTimeout(() => {
      console.error(`[${Date.now()}] Request timeout for token: ${token}, path: ${req.path}`);
      if (!res.headersSent) {
        res.status(504).send(renderErrorPage('Gateway Timeout', 
          'The request timed out while connecting to the target server.',
          `Token: ${token}, Path: ${req.path}`));
      }
    }, 30000); // 30 seconds timeout
    
    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(requestTimeout);
    });

    // Check if we have a cached target info for this token
    const cacheKey = `token:${token}`;
    const cachedTargetInfo = requestCache.get(cacheKey);
    
    if (cachedTargetInfo) {
      if (config.DEBUG) {
        console.log(`[${Date.now()}] Using cached target info for token: ${token} -> ${cachedTargetInfo.domain}`);
      }
      return createProxyMiddleware2(cachedTargetInfo, token)(req, res, next);
    }
    
    // Get target info from token
    const targetInfo = tokenStore.getDomainInfoFromToken(token);
    
    if (!targetInfo) {
      // Si c'est une ressource statique (image, css, js), essayons d'extraire le referer
      // pour voir si on peut trouver le domaine cible
      const referer = req.headers.referer;
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const refererHost = refererUrl.hostname;
          
          if (config.DEBUG) {
            console.log(`[${Date.now()}] Trying to recover token from referer: ${referer}`);
          }
          
          // Si le referer est un de nos sous-domaines, essayons d'utiliser son token
          if (refererHost.endsWith(`.${config.BASE_DOMAIN}`)) {
            const refererToken = refererHost.replace(`.${config.BASE_DOMAIN}`, '');
            const refererTargetInfo = tokenStore.getDomainInfoFromToken(refererToken);
            
            if (refererTargetInfo) {
              if (config.DEBUG) {
                console.log(`[${Date.now()}] Recovered target info from referer token: ${refererToken} -> ${refererTargetInfo.domain}`);
              }
              
              // Cache this information for future requests
              requestCache.set(cacheKey, refererTargetInfo);
              setTimeout(() => requestCache.delete(cacheKey), CACHE_TTL);
              
              return createProxyMiddleware2(refererTargetInfo, token)(req, res, next);
            }
          }
        } catch (error) {
          if (config.DEBUG) {
            console.error(`[${Date.now()}] Error parsing referer:`, error);
          }
        }
      }
      
      // Log la demande complète pour le débogage
      if (config.DEBUG) {
        console.log(`[${Date.now()}] Invalid token: ${token}`);
        console.log(`Request headers:`, req.headers);
        console.log(`Request path: ${req.path}`);
      }
      
      // Essayer de recharger les tokens depuis le fichier
      if (tokenStore.forceReload) {
        console.log(`[${Date.now()}] Forcing token reload to find: ${token}`);
        tokenStore.forceReload();
        
        // Essayer à nouveau après rechargement
        const refreshedTargetInfo = tokenStore.getDomainInfoFromToken(token);
        if (refreshedTargetInfo) {
          console.log(`[${Date.now()}] Found token after reload: ${token} -> ${refreshedTargetInfo.domain}`);
          requestCache.set(cacheKey, refreshedTargetInfo);
          return createProxyMiddleware2(refreshedTargetInfo, token)(req, res, next);
        }
      }
      
      // Si le token est invalide et qu'on n'a pas pu le récupérer du referer
      clearTimeout(requestTimeout);
      return res.status(400).send(renderErrorPage('Invalid Token',
        `The token <strong>${token}</strong> does not match any registered domain.`,
        'Please visit the homepage to generate a valid token.'));
    }
    
    if (config.DEBUG) {
      console.log(`[${Date.now()}] Proxying to ${targetInfo.domain}`);
    }
    
    // Cache this information for future requests
    requestCache.set(cacheKey, targetInfo);
    setTimeout(() => requestCache.delete(cacheKey), CACHE_TTL);
    
    // Create and use proxy middleware, passing the token
    try {
      return createProxyMiddleware2(targetInfo, token)(req, res, next);
    } catch (error) {
      clearTimeout(requestTimeout);
      console.error(`[${Date.now()}] Error creating proxy middleware:`, error);
      return res.status(500).send(renderErrorPage('Proxy Configuration Error',
        'Could not set up proxy for the requested domain.',
        `Error: ${error.message}`));
    }
  });
}

module.exports = { 
  setupProxyHandler,
  createProxyMiddleware2
};