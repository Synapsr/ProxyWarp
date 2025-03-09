/**
 * Routes Module
 * 
 * Sets up the application routes.
 */

const fs = require('fs');
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
  
  // Diagnostic route (only in debug mode)
  if (config.DEBUG) {
    app.get('/admin/diagnostic', (req, res) => {
      // Gather diagnostic information
      const diagnosticInfo = {
        serverTime: new Date().toISOString(),
        config: {
          port: config.PORT,
          baseDomain: config.BASE_DOMAIN,
          debug: config.DEBUG,
          dbFile: config.DB_FILE
        },
        tokenStore: {
          totalTokens: Object.keys(tokenStore.tokens).length,
          domainMappings: Object.keys(tokenStore.domainMapping).length,
          lastSave: tokenStore.lastSave ? new Date(tokenStore.lastSave).toISOString() : null,
          lastLoad: tokenStore.lastLoad ? new Date(tokenStore.lastLoad).toISOString() : null,
          dirty: tokenStore.dirty
        },
        backupInfo: tokenStore.getBackupInfo ? tokenStore.getBackupInfo() : { size: 'N/A' },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          platform: process.platform,
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        },
        fileSystem: {
          dbFileExists: fs.existsSync(config.DB_FILE),
          dbFileStat: fs.existsSync(config.DB_FILE) ? fs.statSync(config.DB_FILE) : null,
          dbFileSize: fs.existsSync(config.DB_FILE) ? fs.statSync(config.DB_FILE).size : 0
        }
      };
      
      // Add token samples (first 5)
      const tokenSamples = Object.entries(tokenStore.tokens).slice(0, 5).map(([token, info]) => ({
        token,
        domain: info.domain,
        timestamp: new Date(info.timestamp).toISOString()
      }));
      
      diagnosticInfo.tokenSamples = tokenSamples;
      
      res.json(diagnosticInfo);
    });
    
    // Route to test direct connection to a domain
    app.get('/admin/test-connection', async (req, res) => {
      const domain = req.query.domain;
      
      if (!domain) {
        return res.status(400).json({
          error: 'Missing domain parameter'
        });
      }
      
      console.log(`[${Date.now()}] Testing direct connection to: ${domain}`);
      
      // Set an overall timeout for the entire operation
      const operationTimeout = setTimeout(() => {
        console.log(`[${Date.now()}] Test connection timeout for domain: ${domain}`);
        if (!res.headersSent) {
          res.status(504).json({
            domain,
            error: 'Operation timed out after 15 seconds',
            success: false
          });
        }
      }, 15000); // 15 second global timeout
      
      try {
        const https = require('https');
        const http = require('http');
        const dns = require('dns');
        const { promisify } = require('util');
        
        // Test results structure
        const testResults = {
          domain,
          tests: {
            dns: null,
            http: null,
            https: null
          },
          success: false
        };
        
        // Test DNS resolution with timeout
        try {
          const dnsLookup = promisify(dns.lookup);
          
          const dnsPromise = new Promise(async (resolve, reject) => {
            const dnsTimeout = setTimeout(() => {
              reject(new Error('DNS lookup timed out after 5 seconds'));
            }, 5000);
            
            try {
              const dnsStart = Date.now();
              const address = await dnsLookup(domain);
              const dnsTime = Date.now() - dnsStart;
              clearTimeout(dnsTimeout);
              
              resolve({
                success: true,
                time: dnsTime,
                address: address.address
              });
            } catch (error) {
              clearTimeout(dnsTimeout);
              reject(error);
            }
          });
          
          testResults.tests.dns = await dnsPromise.catch(error => ({
            success: false,
            error: error.message
          }));
        } catch (dnsError) {
          testResults.tests.dns = {
            success: false,
            error: dnsError.message
          };
        }
        
        // Test HTTPS connection with shorter timeout
        const httpsPromise = new Promise((resolve, reject) => {
          const startTime = Date.now();
          const req = https.request(
            {
              hostname: domain,
              port: 443,
              path: '/',
              method: 'GET',
              timeout: 8000, // 8 second timeout
              headers: {
                'User-Agent': config.USER_AGENT || 'Mozilla/5.0 ProxyWarp/1.0'
              }
            },
            (res) => {
              const time = Date.now() - startTime;
              let data = '';
              
              res.on('data', chunk => {
                data += chunk.toString();
                // Only get the first 1000 characters
                if (data.length > 1000) {
                  res.destroy();
                }
              });
              
              res.on('end', () => {
                resolve({
                  success: true,
                  statusCode: res.statusCode,
                  headers: res.headers,
                  time,
                  bodyPreview: data.substring(0, 1000)
                });
              });
            }
          );
          
          req.on('error', (err) => {
            reject({
              success: false,
              error: err.message,
              time: Date.now() - startTime
            });
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject({
              success: false,
              error: 'Timeout after 8s',
              time: 8000
            });
          });
          
          req.end();
        }).catch(err => err); // Prevent rejection
        
        // Test HTTP connection with shorter timeout
        const httpPromise = new Promise((resolve, reject) => {
          const startTime = Date.now();
          const req = http.request(
            {
              hostname: domain,
              port: 80,
              path: '/',
              method: 'GET',
              timeout: 8000, // 8 second timeout
              headers: {
                'User-Agent': config.USER_AGENT || 'Mozilla/5.0 ProxyWarp/1.0'
              }
            },
            (res) => {
              const time = Date.now() - startTime;
              let data = '';
              
              res.on('data', chunk => {
                data += chunk.toString();
                // Only get the first 1000 characters
                if (data.length > 1000) {
                  res.destroy();
                }
              });
              
              res.on('end', () => {
                resolve({
                  success: true,
                  statusCode: res.statusCode,
                  headers: res.headers,
                  time,
                  bodyPreview: data.substring(0, 1000)
                });
              });
            }
          );
          
          req.on('error', (err) => {
            reject({
              success: false,
              error: err.message,
              time: Date.now() - startTime
            });
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject({
              success: false,
              error: 'Timeout after 8s',
              time: 8000
            });
          });
          
          req.end();
        }).catch(err => err); // Prevent rejection
        
        // Wait for both tests to complete, but with a timeout
        const [httpsResult, httpResult] = await Promise.all([httpsPromise, httpPromise]);
        
        testResults.tests.https = httpsResult;
        testResults.tests.http = httpResult;
        
        // Check if either HTTP or HTTPS succeeded
        testResults.success = httpsResult.success || httpResult.success;
        
        // Clear the operation timeout since we're done
        clearTimeout(operationTimeout);
        
        res.json(testResults);
      } catch (error) {
        // Clear the operation timeout in case of error
        clearTimeout(operationTimeout);
        
        res.status(500).json({
          domain,
          error: error.message,
          stack: config.DEBUG ? error.stack : undefined
        });
      }
    });

    // Route to force token reload
    app.get('/admin/reload-tokens', (req, res) => {
      const count = tokenStore.forceReload ? tokenStore.forceReload() : 'Not supported';
      res.json({
        success: true,
        tokensLoaded: count,
        message: `Reloaded ${count} tokens from database`
      });
    });
    
    // Route to add a test token
    app.get('/admin/add-test-token', (req, res) => {
      const domain = req.query.domain || 'example.com';
      const token = tokenStore.getTokenForDomain(domain);
      
      res.json({
        success: true,
        domain,
        token,
        proxyUrl: `https://${token}.${config.BASE_DOMAIN}`
      });
    });
  }
  
  // Fallback for other routes
  app.use((req, res) => {
    res.status(404).send(renderErrorPage('Page Not Found',
      'The requested resource does not exist on this server.'));
  });
}

module.exports = { setupRoutes };