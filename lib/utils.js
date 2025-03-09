/**
 * Utilities Module
 * 
 * Contains common utility functions used throughout the application.
 */

const config = require('../config');

/**
 * Renders an error page with consistent styling
 * 
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {string} details - Optional error details
 * @returns {string} - HTML for error page
 */
function renderErrorPage(title, message, details = '') {
  return `
    <html>
      <head>
        <title>${title} - ProxyWarp</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; }
          h1 { color: #e53e3e; margin-bottom: 20px; }
          .message { margin-bottom: 20px; }
          .details { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow: auto; font-family: monospace; white-space: pre-wrap; }
          a { color: #3182ce; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="message">${message}</div>
        ${details ? `<div class="details">${details}</div>` : ''}
        <p><a href="/">Return to homepage</a></p>
      </body>
    </html>
  `;
}

/**
 * Extracts domain from URL
 * 
 * @param {string} url - URL to extract domain from
 * @returns {string|null} - Extracted domain or null if invalid
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

/**
 * Gets path and query from URL
 * 
 * @param {string} url - URL to extract from
 * @returns {string} - Combined path and query
 */
function getPathAndQueryFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    return '/';
  }
}

/**
 * Builds a proxy URL for a token
 * 
 * @param {string} token - Token to use
 * @param {string} pathAndQuery - Path and query to append (optional)
 * @returns {string} - Full proxy URL
 */
function buildProxyUrl(token, pathAndQuery = '') {
  // Normalize the pathAndQuery to ensure it starts with a slash if provided
  if (pathAndQuery && !pathAndQuery.startsWith('/')) {
    pathAndQuery = '/' + pathAndQuery;
  }
  
  return `https://${token}.${config.BASE_DOMAIN}${pathAndQuery}`;
}

/**
 * Check if a URL is an external URL relative to a given domain
 * 
 * @param {string} url - URL to check
 * @param {string} domain - Domain to compare against
 * @returns {boolean} - True if external, false otherwise
 */
function isExternalUrl(url, domain) {
  try {
    // Check if it's an absolute URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      // Check if domain matches
      return urlObj.hostname !== domain && urlObj.hostname !== `www.${domain}`;
    }
    
    // Relative URLs are not external
    return false;
  } catch (error) {
    // If we can't parse the URL, consider it internal
    return false;
  }
}

/**
 * Normalizes a URL by ensuring it has a scheme
 * 
 * @param {string} url - URL to normalize
 * @param {string} defaultProtocol - Default protocol to use
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url, defaultProtocol = 'https') {
  if (!url) return '';
  
  // Remove leading and trailing whitespace
  url = url.trim();
  
  // Check if URL already has a scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url;
  }
  
  // Add default scheme
  return `${defaultProtocol}://${url}`;
}

module.exports = {
  renderErrorPage,
  extractDomainFromUrl,
  getPathAndQueryFromUrl,
  buildProxyUrl,
  isExternalUrl,
  normalizeUrl
};