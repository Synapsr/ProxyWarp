/**
 * Configuration module
 *
 * Centralizes all configuration values for the application.
 */
const path = require('path');

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  BASE_DOMAIN: process.env.BASE_DOMAIN || 'proxywarp.com',
  DEBUG: process.env.DEBUG === 'true' || false,
  
  // Token configuration
  TOKEN_LENGTH: 6,
  DB_FILE: process.env.DB_FILE || path.join(__dirname, 'data', 'tokens.json'),
  
  // Token cleaning configuration
  CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
  TOKEN_EXPIRATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Proxy configuration
  DEFAULT_PROTOCOL: 'https',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Timeout values in milliseconds
  TIMEOUTS: {
    PROXY_REQUEST: 20000,      // 20 seconds for proxy requests
    ADMIN_OPERATIONS: 15000,   // 15 seconds for admin operations
    DNS_LOOKUP: 5000,          // 5 seconds for DNS lookups
    HTTP_REQUEST: 8000,        // 8 seconds for HTTP requests
    HTTPS_REQUEST: 8000        // 8 seconds for HTTPS requests
  },
  
  // Cache configuration
  CACHE: {
    TTL: 30 * 1000,            // 30 seconds cache TTL
    MAX_SIZE: 1000             // Maximum number of items in cache
  },
  
  // Error handling options
  ERROR_HANDLING: {
    MAX_RETRIES: 2,            // Maximum number of retries for failed requests
    RETRY_DELAY: 1000          // Delay between retries in milliseconds
  }
};