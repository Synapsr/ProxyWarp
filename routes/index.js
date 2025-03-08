/**
 * Routes Module
 * 
 * Sets up the application routes.
 */

const { tokenStore } = require('../lib/tokenStore');
const { renderErrorPage, extractDomainFromUrl, getPathAndQueryFromUrl, buildProxyUrl } = require('../lib/utils');
const config = require('../config');
const homeTemplate = require('./templates/home');

/**
 * Setup all application routes
 * 
 * @param {object} app - Express application
 */
function setupRoutes(app) {
  // Home page route
  app.get('/', (req, res) => {
    // URL redirection feature
    const url = req.query.url;
    if (url) {
      try {
        // Parse and validate URL
        const domain = extractDomainFromUrl(url);
        if (!domain) {
          throw new Error('Invalid URL');
        }
        
        // Get or create token for domain
        const token = tokenStore.getTokenForDomain(domain);
        
        // Get path and query from URL
        const pathAndQuery = getPathAndQueryFromUrl(url);
        
        // Build and redirect to proxy URL
        const proxyUrl = buildProxyUrl(token, pathAndQuery);
        
        if (config.DEBUG) {
          console.log(`Redirecting ${url} to ${proxyUrl}`);
        }
        
        return res.redirect(proxyUrl);
      } catch (error) {
        if (config.DEBUG) {
          console.error('URL redirection error:', error);
        }
        return res.status(400).send(renderErrorPage('Invalid URL', 
          'The provided URL is invalid or could not be parsed.',
          error.message));
      }
    }
    
    // Normal homepage rendering
    const exampleDomains = ['google.com', 'github.com', 'example.com'];
    const examples = exampleDomains.map(domain => ({
      domain,
      token: tokenStore.getTokenForDomain(domain),
    }));
    
    res.send(homeTemplate(examples, config.BASE_DOMAIN));
  });
  
  // URL conversion API
  app.get('/convert', (req, res) => {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is missing' });
    }
    
    try {
      // Parse and validate URL
      const domain = extractDomainFromUrl(url);
      if (!domain) {
        throw new Error('Invalid URL');
      }
      
      // Get or create token for domain
      const token = tokenStore.getTokenForDomain(domain);
      
      // Get path and query from URL
      const pathAndQuery = getPathAndQueryFromUrl(url);
      
      // Build proxy URL
      const proxyUrl = buildProxyUrl(token, pathAndQuery);
      
      // Return data
      return res.json({
        original: url,
        domain,
        token,
        proxy: proxyUrl
      });
    } catch (error) {
      return res.status(400).json({ error: `Invalid URL: ${error.message}` });
    }
  });
  
  // Token testing API
  app.get('/test-token/:token', (req, res) => {
    const token = req.params.token;
    const info = tokenStore.getDomainInfoFromToken(token);
    
    if (info) {
      res.json({
        token: token,
        targetInfo: info,
        proxyUrl: buildProxyUrl(token)
      });
    } else {
      res.status(404).json({
        error: 'Unknown token',
        token: token
      });
    }
  });
  
  // Admin view all tokens (only in debug mode)
  if (config.DEBUG) {
    app.get('/admin/tokens', (req, res) => {
      res.json(tokenStore.getAllTokens());
    });
  }
  
  // Fallback for other routes
  app.use((req, res) => {
    res.status(404).send(renderErrorPage('Page Not Found',
      'The requested resource does not exist on this server.'));
  });
}

module.exports = { setupRoutes };