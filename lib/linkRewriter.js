/**
 * Link Rewriter Module
 * 
 * Handles rewriting of URLs in proxied HTML content to keep users within the proxy.
 */

const { tokenStore } = require('./tokenStore');
const { buildProxyUrl } = require('./utils');
const { generateClientScript } = require('./clientScript');
const config = require('../config');

/**
 * Determines if response should be processed for link rewriting
 * 
 * @param {Object} proxyRes - Proxy response object
 * @returns {boolean} - Whether the response should be processed
 */
function shouldProcessResponse(proxyRes) {
  const contentType = proxyRes.headers['content-type'] || '';
  return contentType.includes('text/html');
}

/**
 * Creates middleware for rewriting links in HTML responses
 * 
 * @param {Object} targetInfo - Target domain information
 * @returns {Function} - Middleware for response processing
 */
function createResponseRewriter(targetInfo) {
  return (proxyRes, req, res) => {
    // Only process HTML responses
    if (!shouldProcessResponse(proxyRes)) {
      return false; // Don't modify response, let it pass through
    }

    // Get information needed for rewriting
    const token = req.proxyToken; // Token should be attached to the request
    const targetDomain = targetInfo.domain;
    const targetProtocol = targetInfo.protocol;
    const targetOrigin = `${targetProtocol}://${targetDomain}`;

    // Create streams to collect and modify response
    let responseBody = '';
    
    // Capture response data
    proxyRes.on('data', (chunk) => {
      responseBody += chunk.toString('utf8');
    });
    
    // Process and send modified response
    proxyRes.on('end', () => {
      if (config.DEBUG) {
        console.log(`Rewriting links in response from ${targetDomain}`);
      }
      
      // Rewrite absolute URLs that point to the same domain
      responseBody = responseBody.replace(
        new RegExp(`(href|src)=["'](${targetProtocol}:)?//(www\\.)?${targetDomain.replace('.', '\\.')}([^"']*)["']`, 'gi'),
        (match, attr, protocol, www, path) => {
          return `${attr}="${buildProxyUrl(token, path)}"`;
        }
      );
      
      // Rewrite absolute paths (starting with /)
      responseBody = responseBody.replace(
        /\s(href|src)=["']\/([^"']*)["']/gi,
        (match, attr, path) => {
          return ` ${attr}="${buildProxyUrl(token, '/' + path)}"`;
        }
      );
      
      // Rewrite form actions
      responseBody = responseBody.replace(
        /<form([^>]*)action=["']([^"']*)["']/gi,
        (match, formAttrs, actionUrl) => {
          // Skip already proxied URLs
          if (actionUrl.includes(config.BASE_DOMAIN)) {
            return match;
          }
          
          // Handle absolute URLs
          if (actionUrl.startsWith('http')) {
            try {
              const actionUrlObj = new URL(actionUrl);
              // Only proxy URLs for the same domain
              if (actionUrlObj.hostname === targetDomain || 
                  actionUrlObj.hostname === `www.${targetDomain}`) {
                return `<form${formAttrs}action="${buildProxyUrl(token, actionUrlObj.pathname + actionUrlObj.search)}"`;
              }
            } catch (e) {
              // Invalid URL, leave it as is
              return match;
            }
          } 
          // Handle absolute paths
          else if (actionUrl.startsWith('/')) {
            return `<form${formAttrs}action="${buildProxyUrl(token, actionUrl)}"`;
          }
          
          // Leave relative URLs as they are
          return match;
        }
      );
      
      // Add a base tag to help with relative URLs
      const baseTagExists = /<base\s+[^>]*>/i.test(responseBody);
      if (!baseTagExists) {
        responseBody = responseBody.replace(
          /<head[^>]*>/i,
          (match) => {
            return `${match}\n<base href="${buildProxyUrl(token, '/')}">\n`;
          }
        );
      }
      
      // Generate client-side interceptor script
      const clientScript = generateClientScript(token, config.BASE_DOMAIN, targetDomain);
      
      // Inject the script before the closing </body> tag
      const hasBodyEnd = responseBody.includes('</body>');
      if (hasBodyEnd) {
        responseBody = responseBody.replace('</body>', `${clientScript}\n</body>`);
      } else {
        // If no </body> tag found, append to the end
        responseBody += clientScript;
      }
      
      // Set correct content length and send the modified response
      res.setHeader('content-length', Buffer.byteLength(responseBody));
      res.end(responseBody);
    });
    
    // Return true to indicate we're handling the response
    return true;
  };
}

module.exports = {
  createResponseRewriter,
  shouldProcessResponse
};