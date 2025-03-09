/**
 * ProxyWarp - Token-Based Web Proxy
 *
 * Main entry point for the application.
 *
 * @license MIT
 */
const express = require('express');
const cors = require('cors');
const { tokenStore } = require('./lib/tokenStore');
const { setupProxyHandler } = require('./lib/proxyHandler');
const { setupRoutes } = require('./routes');
const config = require('./config');

// Initialize Express app
const app = express();
app.use(cors());

// Track active connections
let connections = new Set();

app.on('connection', (socket) => {
  // Track creation time for debugging purposes
  socket._createdAt = Date.now();
  
  connections.add(socket);
  
  socket.on('close', () => {
    connections.delete(socket);
  });
});

// Implement a connection monitor that logs stuck connections
setInterval(() => {
  if (connections.size > 100) { // Adjust threshold based on your expected traffic
    console.warn(`[${Date.now()}] High number of connections: ${connections.size}`);
    
    if (config.DEBUG) {
      let oldConnections = 0;
      const now = Date.now();
      connections.forEach((socket) => {
        const connectionTime = socket._createdAt ? now - socket._createdAt : 'unknown';
        if (connectionTime > 30000) { // connections older than 30 seconds
          oldConnections++;
        }
      });
      console.warn(`[${Date.now()}] ${oldConnections} connections are older than 30 seconds`);
    }
  }
}, 10000); // Check every 10 seconds

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
    'An unexpected error occurred on the server.',
    config.DEBUG ? err.stack : null));
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