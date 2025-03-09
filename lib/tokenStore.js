/**
 * Token Store Module - With reliable persistence
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
    
    // In-memory cache with last save timestamp
    this.lastSave = 0;
    this.lastLoad = 0;
    this.dirty = false;
    this.saveTimeout = null;
    
    // Lock to prevent concurrent read/writes
    this.isLoading = false;
    
    // Emergency backup in memory
    this.backupTokens = new Map();
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
      
      this._loadTokensFromFile();
      
      // Set up periodic cleanup
      this._setupCleanup();
      
      // Setup periodic saving if tokens are modified
      this._setupPeriodicSave();
      
      // Setup periodic reloading to pick up changes from other processes
      this._setupPeriodicReload();
      
      console.log('Token store initialized successfully');
    } catch (error) {
      console.error('Error initializing token store:', error);
      this.tokens = {};
      this.domainMapping = {};
      this.save(true);
    }
  }
  
  /**
   * Load tokens from file
   * @private
   */
  _loadTokensFromFile() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    try {
      // Load existing tokens
      if (fs.existsSync(config.DB_FILE)) {
        const data = fs.readFileSync(config.DB_FILE, 'utf8');
        
        try {
          const loadedTokens = JSON.parse(data);
          this.tokens = loadedTokens;
          
          // Rebuild the domain mapping
          this.domainMapping = {};
          for (const [token, info] of Object.entries(this.tokens)) {
            if (info && info.domain) {
              this.domainMapping[info.domain] = token;
              
              // Update backup
              this.backupTokens.set(token, { 
                ...info,
                source: 'file'
              });
            }
          }
          
          this.lastLoad = Date.now();
          console.log(`Loaded ${Object.keys(this.tokens).length} tokens from database`);
        } catch (parseError) {
          console.error('Error parsing token database:', parseError);
          // If parsing fails, try to recover from backup
          if (this.backupTokens.size > 0) {
            console.log('Recovering from in-memory backup');
            this.tokens = {};
            for (const [token, info] of this.backupTokens.entries()) {
              this.tokens[token] = {
                domain: info.domain,
                protocol: info.protocol || config.DEFAULT_PROTOCOL,
                timestamp: info.timestamp || Date.now()
              };
              this.domainMapping[info.domain] = token;
            }
            this.save(true);
          }
        }
      } else {
        console.log('Creating new token database');
        this.save(true); // Force save
      }
    } catch (error) {
      console.error('Error loading tokens from file:', error);
      
      // Try to recover from backup
      if (this.backupTokens.size > 0) {
        console.log('Recovering from in-memory backup after load error');
        this.tokens = {};
        for (const [token, info] of this.backupTokens.entries()) {
          this.tokens[token] = {
            domain: info.domain,
            protocol: info.protocol || config.DEFAULT_PROTOCOL,
            timestamp: info.timestamp || Date.now()
          };
          this.domainMapping[info.domain] = token;
        }
      } else {
        this.tokens = {};
        this.domainMapping = {};
      }
      
      this.save(true);
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Save tokens to persistent storage with throttling
   * @param {boolean} force - Force immediate save
   */
  save(force = false) {
    this.dirty = true;
    
    // If a save is already scheduled, don't schedule another one
    if (this.saveTimeout && !force) {
      return;
    }
    
    // If forced or it's been a while since the last save, save immediately
    const now = Date.now();
    if (force || now - this.lastSave > 10000) { // 10 seconds
      this._saveImmediately();
    } else {
      // Schedule a save for later
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this._saveImmediately();
      }, 2000); // 2 second debounce
    }
  }
  
  /**
   * Save tokens immediately
   * @private
   */
  _saveImmediately() {
    if (!this.dirty) return;
    
    try {
      // Create a copy of the data to save
      const dataToSave = JSON.stringify(this.tokens, null, 2);
      
      // Atomic file write using a temporary file
      const tempFile = `${config.DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, dataToSave, 'utf8');
      fs.renameSync(tempFile, config.DB_FILE);
      
      this.lastSave = Date.now();
      this.dirty = false;
      this.saveTimeout = null;
      
      if (config.DEBUG) {
        console.log('Saved token database to file');
      }
    } catch (error) {
      console.error('Error saving token database:', error);
    }
  }
  
  /**
   * Setup periodic save to ensure data is persisted
   * @private
   */
  _setupPeriodicSave() {
    // Every 30 seconds, check if there are unsaved changes
    setInterval(() => {
      if (this.dirty) {
        this._saveImmediately();
      }
    }, 30 * 1000);
  }
  
  /**
   * Setup periodic reload to pick up changes from other processes
   * @private
   */
  _setupPeriodicReload() {
    // Every 2 minutes, reload the file
    setInterval(() => {
      if (!this.isLoading && !this.dirty) {
        this._loadTokensFromFile();
      }
    }, 2 * 60 * 1000);
  }
  
  /**
   * Get or create a token for a domain
   * 
   * @param {string} domain - Domain to get token for
   * @returns {string} - The token
   */
  getTokenForDomain(domain) {
    // Normalize domain by converting to lowercase
    domain = domain.toLowerCase();
    
    // Check if domain already has a token
    if (this.domainMapping[domain]) {
      const token = this.domainMapping[domain];
      
      // Update timestamp
      if (this.tokens[token]) {
        this.tokens[token].timestamp = Date.now();
        
        // Update backup
        this.backupTokens.set(token, {
          ...this.tokens[token],
          source: 'cache_update'
        });
        
        this.dirty = true;
        return token;
      }
    }
    
    // Reload from file if it's been a while, maybe another process created this token
    if (Date.now() - this.lastLoad > 60000) { // 1 minute
      this._loadTokensFromFile();
      
      // Check again after reload
      if (this.domainMapping[domain]) {
        const token = this.domainMapping[domain];
        if (this.tokens[token]) {
          this.tokens[token].timestamp = Date.now();
          this.dirty = true;
          return token;
        }
      }
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
    
    // Update backup
    this.backupTokens.set(token, {
      ...this.tokens[token],
      source: 'new_token'
    });
    
    // Immediate save for new tokens
    this.save(true);
    
    return token;
  }
  
  /**
   * Get domain information from a token
   * 
   * @param {string} token - Token to look up
   * @returns {object|null} - Domain information or null if not found
   */
  getDomainInfoFromToken(token) {
    // Add robust error handling
    if (!token || typeof token !== 'string') {
      if (config.DEBUG) {
        console.error('Invalid token type:', typeof token);
      }
      return null;
    }
    
    // Normalize token
    token = token.trim();
    
    // Check if token exists in our store
    if (!this.tokens[token]) {
      // Check in-memory backup
      if (this.backupTokens.has(token)) {
        const backupInfo = this.backupTokens.get(token);
        if (config.DEBUG) {
          console.log(`Recovered token ${token} from backup (${backupInfo.source})`);
        }
        
        // Restore from backup
        this.tokens[token] = {
          domain: backupInfo.domain,
          protocol: backupInfo.protocol || config.DEFAULT_PROTOCOL,
          timestamp: Date.now()
        };
        
        this.domainMapping[backupInfo.domain] = token;
        this.dirty = true;
        
        return this.tokens[token];
      }
      
      // Reload from file - maybe another process created this token
      if (Date.now() - this.lastLoad > 30000) { // 30 seconds
        this._loadTokensFromFile();
      }
      
      // Check again after reload
      if (!this.tokens[token]) {
        if (config.DEBUG) {
          console.log(`Token not found in store or backup: ${token}`);
        }
        return null;
      }
    }
    
    // Update last accessed timestamp
    this.tokens[token].timestamp = Date.now();
    this.dirty = true;
    
    // Update backup
    this.backupTokens.set(token, {
      ...this.tokens[token],
      source: 'get_update'
    });
    
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
    let attempts = 0;
    
    do {
      // Use crypto for better randomness
      const bytes = crypto.randomBytes(config.TOKEN_LENGTH);
      token = Array.from(bytes)
        .map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'
          .charAt(b % 36))
        .join('');
      
      attempts++;
      // Avoid infinite loops
      if (attempts > 10) {
        // If we've tried 10 times, add a unique suffix
        token += Date.now().toString(36).slice(-4);
        break;
      }
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
      let hasChanges = false;
      
      for (const [token, info] of Object.entries(this.tokens)) {
        if (now - info.timestamp > config.TOKEN_EXPIRATION_MS) {
          delete this.domainMapping[info.domain];
          delete this.tokens[token];
          this.backupTokens.delete(token);
          count++;
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
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
  
  /**
   * Get token backup info (for debugging)
   * 
   * @returns {object} - Backup information
   */
  getBackupInfo() {
    return {
      size: this.backupTokens.size,
      tokens: Array.from(this.backupTokens.entries()).map(([token, info]) => ({
        token,
        domain: info.domain,
        source: info.source
      }))
    };
  }
  
  /**
   * Force reload tokens from file
   * Useful for admin interfaces
   */
  forceReload() {
    this._loadTokensFromFile();
    return Object.keys(this.tokens).length;
  }
}

// Export a singleton instance
const tokenStore = new TokenStore();

module.exports = { tokenStore };