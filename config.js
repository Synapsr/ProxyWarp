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
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};