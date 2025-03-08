/**
 * ProxyWarp - Token-Based Web Proxy
 * 
 * Main entry point for the application.
 * 
 * @license MIT
 */

const express = require('express');
const { tokenStore } = require('./lib/tokenStore');
const { setupProxyHandler } = require('./lib/proxyHandler');
const { setupRoutes } = require('./routes');
const config = require('./config');

// Initialize Express app
const app = express();

// Initialize token store
tokenStore.initialize();

// Setup proxy handler middleware (must be before routes)
setupProxyHandler(app);

// Setup regular routes
setupRoutes(app);

// Add global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(500).send(require('./lib/utils').renderErrorPage('Server Error',
    'An unexpected error occurred on the server.'));
});

// Start the server
app.listen(config.PORT, () => {
  console.log(`
======================================================
  ProxyWarp - Token-Based Proxy
======================================================
  Server started on port ${config.PORT}
  Base domain: ${config.BASE_DOMAIN}
  Debug mode: ${config.DEBUG ? 'Enabled' : 'Disabled'}
  Token database: ${config.DB_FILE}
  
  Example URLs:
  - Homepage: http://${config.BASE_DOMAIN}
  - Redirection URL: http://${config.BASE_DOMAIN}/?url=https://example.com
======================================================
`);
});