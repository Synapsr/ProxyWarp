/**
 * Proxy Handler Module
 * 
 * Handles proxy requests for subdomains.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { tokenStore } = require('./tokenStore');
const { renderErrorPage } = require('./utils');
const config = require('../config');

/**
 * Creates a proxy middleware for a target domain
 * 
 * @param {object} targetInfo - Target domain information
 * @returns {function} - Configured proxy middleware
 */
function createProxyMiddleware2(targetInfo) {
  return createProxyMiddleware({
    target: `${targetInfo.protocol}://${targetInfo.domain}`,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    
    onProxyReq: (proxyReq, req, res) => {
      // Set standard headers
      proxyReq.setHeader('User-Agent', config.USER_AGENT);
      proxyReq.setHeader('Referer', `${targetInfo.protocol}://${targetInfo.domain}/`);
      proxyReq.setHeader('Host', targetInfo.domain);
      
      // Remove proxy-specific headers
      proxyReq.removeHeader('x-forwarded-host');
      proxyReq.removeHeader('x-forwarded-proto');
      
      if (config.DEBUG) {
        console.log(`Proxy request: ${req.method} ${req.path} -> ${targetInfo.domain}`);
      }
    },
    
    onProxyRes: (proxyRes, req, res) => {
      // Remove security headers that prevent embedding
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['content-security-policy-report-only'];
      delete proxyRes.headers['feature-policy'];
      delete proxyRes.headers['permissions-policy'];
      
      // Add permissive CORS headers
      proxyRes.headers['access-control-allow-origin'] = '*';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      
      if (config.DEBUG) {
        console.log(`Proxy response: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
      }
    },
    
    // Error handling
    onError: (err, req, res) => {
      console.error(`Proxy error: ${req.method} ${req.path} -> ${err.message}`);
      
      if (res.headersSent) {
        return;
      }
      
      res.status(500).send(renderErrorPage('Proxy Error', 
        'An error occurred while connecting to the requested site.',
        err.message));
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
      console.log(`Request host: ${host}, BASE_DOMAIN: ${config.BASE_DOMAIN}`);
    }
    
    // Skip non-subdomain requests
    if (!host || host === config.BASE_DOMAIN || !host.endsWith(`.${config.BASE_DOMAIN}`)) {
      return next();
    }
    
    // Get token from subdomain
    const token = host.replace(`.${config.BASE_DOMAIN}`, '');
    
    if (config.DEBUG) {
      console.log(`Processing subdomain request with token: ${token}`);
    }
    
    // Get target info from token
    const targetInfo = tokenStore.getDomainInfoFromToken(token);
    
    if (!targetInfo) {
      if (config.DEBUG) {
        console.log(`Invalid token: ${token}`);
      }
      return res.status(400).send(renderErrorPage('Invalid Token',
        `The token <strong>${token}</strong> does not match any registered domain.`,
        'Please visit the homepage to generate a valid token.'));
    }
    
    if (config.DEBUG) {
      console.log(`Proxying to ${targetInfo.domain}`);
    }
    
    // Create and use proxy middleware
    return createProxyMiddleware2(targetInfo)(req, res, next);
  });
}

module.exports = { 
  setupProxyHandler,
  createProxyMiddleware2
};