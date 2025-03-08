/**
 * Token Store Module
 * 
 * Manages the storage and retrieval of tokens for domain mapping.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

/**
 * TokenStore class for managing domain-to-token mappings
 */
class TokenStore {
  constructor() {
    // Maps tokens to domain information
    this.tokens = {};
    
    // Maps domains to their tokens (for quick lookups)
    this.domainMapping = {};
  }
  
  /**
   * Initialize the token store from persistent storage
   */
  initialize() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(config.DB_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Load existing tokens
      if (fs.existsSync(config.DB_FILE)) {
        const data = fs.readFileSync(config.DB_FILE, 'utf8');
        this.tokens = JSON.parse(data);
        
        // Rebuild the domain mapping
        this.domainMapping = {};
        for (const [token, info] of Object.entries(this.tokens)) {
          this.domainMapping[info.domain] = token;
        }
        
        console.log(`Loaded ${Object.keys(this.tokens).length} tokens from database`);
      } else {
        console.log('Creating new token database');
        this.save();
      }
      
      // Set up periodic cleanup
      this._setupCleanup();
    } catch (error) {
      console.error('Error initializing token store:', error);
      this.tokens = {};
      this.domainMapping = {};
      this.save();
    }
  }
  
  /**
   * Save tokens to persistent storage
   */
  save() {
    try {
      fs.writeFileSync(config.DB_FILE, JSON.stringify(this.tokens, null, 2), 'utf8');
      if (config.DEBUG) {
        console.log('Saved token database to file');
      }
    } catch (error) {
      console.error('Error saving token database:', error);
    }
  }
  
  /**
   * Get or create a token for a domain
   * 
   * @param {string} domain - Domain to get token for
   * @returns {string} - The token
   */
  getTokenForDomain(domain) {
    // Check if domain already has a token
    if (this.domainMapping[domain]) {
      const token = this.domainMapping[domain];
      // Update timestamp
      this.tokens[token].timestamp = Date.now();
      return token;
    }
    
    // Generate a new token
    const token = this._generateToken();
    
    // Save the token mapping
    this.tokens[token] = {
      domain,
      protocol: config.DEFAULT_PROTOCOL,
      timestamp: Date.now()
    };
    
    this.domainMapping[domain] = token;
    this.save();
    
    return token;
  }
  
  /**
   * Get domain information from a token
   * 
   * @param {string} token - Token to look up
   * @returns {object|null} - Domain information or null if not found
   */
  getDomainInfoFromToken(token) {
    if (!this.tokens[token]) {
      return null;
    }
    
    // Update last accessed timestamp
    this.tokens[token].timestamp = Date.now();
    
    return this.tokens[token];
  }
  
  /**
   * Generate a new unique token
   * 
   * @returns {string} - Generated token
   * @private
   */
  _generateToken() {
    let token;
    do {
      // Use crypto for better randomness
      const bytes = crypto.randomBytes(config.TOKEN_LENGTH);
      token = Array.from(bytes)
        .map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'
          .charAt(b % 36))
        .join('');
    } while (token in this.tokens);
    
    return token;
  }
  
  /**
   * Setup periodic cleanup of expired tokens
   * 
   * @private
   */
  _setupCleanup() {
    setInterval(() => {
      const now = Date.now();
      let count = 0;
      
      for (const [token, info] of Object.entries(this.tokens)) {
        if (now - info.timestamp > config.TOKEN_EXPIRATION_MS) {
          delete this.domainMapping[info.domain];
          delete this.tokens[token];
          count++;
        }
      }
      
      if (count > 0) {
        console.log(`Cleaned ${count} expired tokens from database`);
        this.save();
      }
    }, config.CLEANUP_INTERVAL_MS);
  }
  
  /**
   * Get all tokens (for debugging/admin)
   * 
   * @returns {object} - All token information
   */
  getAllTokens() {
    return { ...this.tokens };
  }
}

// Export a singleton instance
const tokenStore = new TokenStore();

module.exports = { tokenStore };