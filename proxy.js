/**
 * ProxyWarp - Transparent Web Proxy with Base64 Subdomains
 * 
 * This script provides a proxy service accessible via Base64-encoded subdomains.
 * It allows accessing any website without modifying its original content,
 * while bypassing CORS and embedding restrictions.
 * 
 * @license MIT
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const vhost = require('vhost');

// Configuration
const PORT = process.env.PORT || 3000;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'proxywarp.com';
const DEBUG = process.env.DEBUG === 'true' || false;

// Initialize the application
const app = express();

/**
 * Cache for decoded domain information
 * Prevents decoding the same subdomain multiple times
 * @type {Map<string, {domain: string, protocol: string, timestamp: number}>}
 */
const domainCache = new Map();

/**
 * Periodically clean the cache to prevent memory leaks
 * Removes entries older than 1 hour
 */
setInterval(() => {
  const now = Date.now();
  let count = 0;
  
  for (const [subdomain, info] of domainCache.entries()) {
    if (now - info.timestamp > 60 * 60 * 1000) { // 1 hour
      domainCache.delete(subdomain);
      count++;
    }
  }
  
  if (DEBUG && count > 0) {
    console.log(`Cache cleaned: ${count} entries removed`);
  }
}, 15 * 60 * 1000); // Every 15 minutes

/**
 * Decodes a Base64-encoded subdomain into a target domain
 * 
 * @param {string} subdomain - The Base64-encoded subdomain
 * @returns {object|null} - Target domain information {domain, protocol, timestamp}
 */
function decodeSubdomain(subdomain) {
  // Check if information is already in the cache
  if (domainCache.has(subdomain)) {
    const cachedInfo = domainCache.get(subdomain);
    // Update timestamp
    cachedInfo.timestamp = Date.now();
    return cachedInfo;
  }
  
  try {
    // Attempt Base64 decoding
    const decoded = Buffer.from(subdomain, 'base64').toString('utf-8');
    
    // Validate if it's a proper domain
    if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(decoded)) {
      throw new Error('Invalid domain format after decoding');
    }
    
    // Create domain information object
    const targetInfo = {
      domain: decoded,
      protocol: 'https', // Default to HTTPS
      timestamp: Date.now()
    };
    
    // Store in cache
    domainCache.set(subdomain, targetInfo);
    
    if (DEBUG) {
      console.log(`Subdomain decoded: ${subdomain} -> ${decoded}`);
    }
    
    return targetInfo;
  } catch (error) {
    if (DEBUG) {
      console.error(`Error decoding subdomain ${subdomain}:`, error);
    }
    return null;
  }
}

/**
 * Creates a proxy middleware for a specific target domain
 * 
 * @param {Object} targetInfo - Target domain information {domain, protocol}
 * @returns {Function} - Configured proxy middleware
 */
function createSubdomainProxy(targetInfo) {
  return createProxyMiddleware({
    target: `${targetInfo.protocol}://${targetInfo.domain}`,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    
    // Handle the request before sending it to the target server
    onProxyReq: (proxyReq, req, res) => {
      // Set a standard User-Agent to avoid blocking
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Add proper referer to help retrieve resources
      proxyReq.setHeader('Referer', `${targetInfo.protocol}://${targetInfo.domain}/`);
      
      // Set Host header to mimic a direct request
      proxyReq.setHeader('Host', targetInfo.domain);
      
      // Remove custom headers to avoid forwarding them
      proxyReq.removeHeader('x-forwarded-host');
      proxyReq.removeHeader('x-forwarded-proto');
      
      if (DEBUG) {
        console.log(`Proxy request: ${req.method} ${req.path} -> ${targetInfo.domain}`);
      }
    },
    
    // Handle the response before sending it to the client
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
      
      if (DEBUG) {
        console.log(`Proxy response: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
      }
    },
    
    // Error handling
    onError: (err, req, res) => {
      const errorMsg = `Proxy error: ${err.message}`;
      
      console.error(`[Proxy Error] ${req.method} ${req.path}: ${err.message}`);
      
      // Check if headers have already been sent
      if (res.headersSent) {
        return;
      }
      
      // Send an error response
      res.status(500).send(`
        <html>
          <head>
            <title>ProxyWarp Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
              h1 { color: #e74c3c; }
              pre { background: #f8f8f8; padding: 15px; border-radius: 5px; overflow: auto; }
            </style>
          </head>
          <body>
            <h1>ProxyWarp Error</h1>
            <p>An error occurred while connecting to the requested site.</p>
            <pre>${errorMsg}</pre>
          </body>
        </html>
      `);
    }
  });
}

/**
 * URL conversion route (for easily generating proxy URLs)
 */
app.get('/convert', (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send('URL parameter is missing');
  }
  
  try {
    // Validate and parse the URL
    const targetUrl = new URL(url);
    
    // Encode the domain in Base64
    const encodedDomain = Buffer.from(targetUrl.hostname).toString('base64');
    
    // Build the proxied URL
    const proxyUrl = `https://${encodedDomain}.${BASE_DOMAIN}${targetUrl.pathname}${targetUrl.search}`;
    
    // Return results as JSON
    res.json({
      original: url,
      encodedDomain: encodedDomain,
      proxy: proxyUrl
    });
  } catch (error) {
    res.status(400).json({
      error: `Invalid URL: ${error.message}`
    });
  }
});

/**
 * Homepage with documentation
 */
app.get('/', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const hostname = req.headers.host;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ProxyWarp - Transparent Proxy with Base64 Subdomains</title>
        <style>
          :root {
            --primary-color: #3498db;
            --secondary-color: #2980b9;
            --accent-color: #f1c40f;
            --text-color: #333;
            --light-bg: #f8f9fa;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          h1, h2, h3 {
            color: var(--secondary-color);
          }
          
          h1 {
            border-bottom: 2px solid var(--accent-color);
            padding-bottom: 10px;
          }
          
          code {
            background: var(--light-bg);
            padding: 2px 5px;
            border-radius: 3px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          }
          
          .example {
            background: var(--light-bg);
            padding: 15px;
            border-left: 4px solid var(--primary-color);
            margin: 20px 0;
          }
          
          input[type="url"] {
            width: 100%;
            max-width: 500px;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
          }
          
          button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          
          button:hover {
            background-color: var(--secondary-color);
          }
          
          .conversion-result {
            display: none;
            margin-top: 15px;
            padding: 15px;
            background: #e8f4f8;
            border-radius: 5px;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>ProxyWarp</h1>
        <p>Access any website through a transparent proxy using Base64-encoded subdomains.</p>
        
        <h2>How to Use</h2>
        <p>To access a website, use the following format:</p>
        <div class="example">
          <code>https://BASE64(target-domain).${BASE_DOMAIN}</code>
        </div>
        
        <h2>Examples</h2>
        <ul>
          <li>
            To access <code>https://example.com</code>:
            <br>
            <code>https://${Buffer.from('example.com').toString('base64')}.${BASE_DOMAIN}</code>
          </li>
          <li>
            To access <code>https://github.com</code>:
            <br>
            <code>https://${Buffer.from('github.com').toString('base64')}.${BASE_DOMAIN}</code>
          </li>
        </ul>
        
        <h2>URL Conversion Tool</h2>
        <p>Convert any URL automatically with the tool below:</p>
        
        <div id="converter">
          <div class="form-group">
            <input type="url" id="url-input" placeholder="https://example.com" required>
            <button id="convert-btn">Convert</button>
          </div>
          
          <div id="result" class="conversion-result">
            <div>
              <strong>Original URL:</strong>
              <span id="original-url"></span>
            </div>
            <div>
              <strong>Encoded domain:</strong>
              <span id="encoded-domain"></span>
            </div>
            <div>
              <strong>Proxied URL:</strong>
              <a href="#" id="proxy-url" target="_blank"></a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>ProxyWarp - Open Source Transparent Proxy</p>
        </div>
        
        <script>
          document.getElementById('convert-btn').addEventListener('click', async () => {
            const urlInput = document.getElementById('url-input').value;
            
            if (!urlInput) {
              alert('Please enter a valid URL');
              return;
            }
            
            try {
              const response = await fetch('/convert?url=' + encodeURIComponent(urlInput));
              const data = await response.json();
              
              if (data.error) {
                alert('Error: ' + data.error);
                return;
              }
              
              document.getElementById('original-url').textContent = data.original;
              document.getElementById('encoded-domain').textContent = data.encodedDomain;
              
              const proxyUrlEl = document.getElementById('proxy-url');
              proxyUrlEl.textContent = data.proxy;
              proxyUrlEl.href = data.proxy;
              
              document.getElementById('result').style.display = 'block';
            } catch (error) {
              alert('Error during conversion: ' + error.message);
            }
          });
          
          // Support Enter key to submit
          document.getElementById('url-input').addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
              document.getElementById('convert-btn').click();
            }
          });
        </script>
      </body>
    </html>
  `);
});

/**
 * Dynamic subdomain handler
 * Processes all requests directed to subdomains of the base domain
 */
app.use(vhost(`*.${BASE_DOMAIN}`, (req, res, next) => {
  // Extract the subdomain from the host
  const host = req.headers.host;
  const subdomain = host.replace(`.${BASE_DOMAIN}`, '');
  
  // Decode the subdomain to get the target domain
  const targetInfo = decodeSubdomain(subdomain);
  
  if (!targetInfo) {
    return res.status(400).send(`
      <html>
        <head>
          <title>Invalid Subdomain</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1>Invalid Subdomain</h1>
          <p>The subdomain <strong>${subdomain}</strong> could not be decoded into a valid target domain.</p>
          <p>Make sure the subdomain is properly Base64-encoded.</p>
          <p><a href="http://${BASE_DOMAIN}">Return to homepage</a></p>
        </body>
      </html>
    `);
  }
  
  // Create and use a proxy for this subdomain
  createSubdomainProxy(targetInfo)(req, res, next);
}));

/**
 * Fallback for unhandled routes
 */
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>Page Not Found</h1>
        <p>The requested resource does not exist on this server.</p>
        <p><a href="/">Return to homepage</a></p>
      </body>
    </html>
  `);
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(500).send(`
    <html>
      <head>
        <title>Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>Server Error</h1>
        <p>An unexpected error occurred on the server.</p>
        <p><a href="/">Return to homepage</a></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`
=======================================================
  ProxyWarp - Base64 Subdomain Proxy
=======================================================
  Server started on port ${PORT}
  Base domain: ${BASE_DOMAIN}
  Debug mode: ${DEBUG ? 'Enabled' : 'Disabled'}
  
  Usage example:
  https://${Buffer.from('example.com').toString('base64')}.${BASE_DOMAIN}
=======================================================
  `);
});