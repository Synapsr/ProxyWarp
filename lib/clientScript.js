/**
 * Client Script Generator
 * 
 * Generates a script to be injected into proxied pages to handle
 * client-side navigation and dynamic link creation.
 */

/**
 * Generates the client-side interception script
 * 
 * @param {string} token - The token for this proxy session
 * @param {string} baseDomain - The base domain of the proxy
 * @param {string} targetDomain - The target domain being proxied
 * @returns {string} - JavaScript code to be injected
 */
function generateClientScript(token, baseDomain, targetDomain) {
    return `
  <script data-proxywarp-injected="true">
  (function() {
    // Configuration
    const PROXY_TOKEN = '${token}';
    const PROXY_BASE_DOMAIN = '${baseDomain}';
    const TARGET_DOMAIN = '${targetDomain}';
    const PROXY_URL_PREFIX = 'https://' + PROXY_TOKEN + '.' + PROXY_BASE_DOMAIN;
    
    // Debug mode - set to true for console logs
    const DEBUG = false;
    
    /**
     * Logs message if debug mode is enabled
     */
    function debugLog(...args) {
      if (DEBUG) {
        console.log('[ProxyWarp]', ...args);
      }
    }
    
    /**
     * Determines if a URL is external (not on the target domain)
     */
    function isExternalUrl(url) {
      try {
        // Handle relative URLs
        if (url.startsWith('/') || !url.includes('://')) {
          return false;
        }
        
        const urlObj = new URL(url);
        return urlObj.hostname !== TARGET_DOMAIN && 
               urlObj.hostname !== 'www.' + TARGET_DOMAIN;
      } catch (e) {
        return false;
      }
    }
    
    /**
     * Converts a URL to its proxied equivalent
     */
    function getProxiedUrl(url) {
      try {
        // Skip if already proxied
        if (url.includes(PROXY_BASE_DOMAIN)) {
          return url;
        }
        
        // Handle different URL formats
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // Absolute URL - only proxy if it's for the target domain
          const urlObj = new URL(url);
          if (urlObj.hostname === TARGET_DOMAIN || 
              urlObj.hostname === 'www.' + TARGET_DOMAIN) {
            return PROXY_URL_PREFIX + urlObj.pathname + urlObj.search + urlObj.hash;
          }
          return url; // External URL - don't proxy
        } else if (url.startsWith('/')) {
          // Absolute path
          return PROXY_URL_PREFIX + url;
        } else if (url.startsWith('#')) {
          // Hash only - keep as is
          return url;
        } else if (url.startsWith('javascript:')) {
          // JavaScript protocol - keep as is
          return url;
        } else if (url.startsWith('mailto:') || url.startsWith('tel:')) {
          // Other protocols - keep as is
          return url;
        } else {
          // Relative path - keep as is (handled by base tag)
          return url;
        }
      } catch (e) {
        debugLog('Error converting URL:', url, e);
        return url; // Return original on error
      }
    }
    
    /**
     * Override history.pushState and history.replaceState
     */
    function overrideHistoryMethods() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(state, title, url) {
        if (url) {
          const proxiedUrl = getProxiedUrl(url);
          debugLog('pushState intercepted:', url, '->', proxiedUrl);
          return originalPushState.call(this, state, title, proxiedUrl);
        }
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        if (url) {
          const proxiedUrl = getProxiedUrl(url);
          debugLog('replaceState intercepted:', url, '->', proxiedUrl);
          return originalReplaceState.call(this, state, title, proxiedUrl);
        }
        return originalReplaceState.call(this, state, title, url);
      };
      
      debugLog('History methods overridden');
    }
    
    /**
     * Override the Location object setters
     */
    function overrideLocationSetters() {
      // Store original setters
      const originalHref = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
      
      // Define new setter for href
      Object.defineProperty(window.Location.prototype, 'href', {
        set: function(url) {
          const proxiedUrl = getProxiedUrl(url);
          debugLog('location.href intercepted:', url, '->', proxiedUrl);
          return originalHref.set.call(this, proxiedUrl);
        },
        get: originalHref.get,
        configurable: true
      });
      
      // Also handle location.assign and location.replace
      const originalAssign = window.Location.prototype.assign;
      window.Location.prototype.assign = function(url) {
        const proxiedUrl = getProxiedUrl(url);
        debugLog('location.assign intercepted:', url, '->', proxiedUrl);
        return originalAssign.call(this, proxiedUrl);
      };
      
      const originalReplace = window.Location.prototype.replace;
      window.Location.prototype.replace = function(url) {
        const proxiedUrl = getProxiedUrl(url);
        debugLog('location.replace intercepted:', url, '->', proxiedUrl);
        return originalReplace.call(this, proxiedUrl);
      };
      
      debugLog('Location methods overridden');
    }
    
    /**
     * Intercept clicks on links
     */
    function setupLinkClickInterceptor() {
      document.addEventListener('click', function(e) {
        // Find if the click was on or inside an <a> element
        let element = e.target;
        while (element && element.tagName !== 'A') {
          element = element.parentElement;
        }
        
        if (!element) return; // Not a link
        
        const href = element.getAttribute('href');
        if (!href) return; // No href attribute
        
        // Skip special links
        if (href.startsWith('javascript:') || 
            href.startsWith('mailto:') || 
            href.startsWith('tel:') || 
            href.startsWith('#')) {
          return;
        }
        
        // Skip already proxied links
        if (href.includes(PROXY_BASE_DOMAIN)) {
          return;
        }
        
        // Skip external links
        if (isExternalUrl(href)) {
          return;
        }
        
        // Intercept the click
        e.preventDefault();
        
        // Get the proxied URL and navigate
        const proxiedUrl = getProxiedUrl(href);
        debugLog('Link click intercepted:', href, '->', proxiedUrl);
        window.location.href = proxiedUrl;
      }, true);
      
      debugLog('Link click interceptor set up');
    }
    
    /**
     * Update links in newly added DOM elements
     */
    function setupMutationObserver() {
      // Create an observer instance
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          // Process added nodes
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            
            // Process <a> elements
            const links = node.tagName === 'A' ? [node] : node.querySelectorAll('a');
            links.forEach(function(link) {
              const href = link.getAttribute('href');
              if (!href) return;
              
              // Skip special links and already proxied links
              if (href.startsWith('javascript:') || 
                  href.startsWith('mailto:') || 
                  href.startsWith('tel:') || 
                  href.startsWith('#') ||
                  href.includes(PROXY_BASE_DOMAIN) ||
                  isExternalUrl(href)) {
                return;
              }
              
              const proxiedHref = getProxiedUrl(href);
              if (proxiedHref !== href) {
                debugLog('Updated dynamically added link:', href, '->', proxiedHref);
                link.setAttribute('href', proxiedHref);
              }
            });
            
            // Process <form> elements
            const forms = node.tagName === 'FORM' ? [node] : node.querySelectorAll('form');
            forms.forEach(function(form) {
              const action = form.getAttribute('action');
              if (!action) return;
              
              // Skip already proxied actions
              if (action.includes(PROXY_BASE_DOMAIN) || isExternalUrl(action)) {
                return;
              }
              
              const proxiedAction = getProxiedUrl(action);
              if (proxiedAction !== action) {
                debugLog('Updated dynamically added form action:', action, '->', proxiedAction);
                form.setAttribute('action', proxiedAction);
              }
            });
          });
        });
      });
      
      // Observe the whole document with all child nodes
      observer.observe(document, { 
        childList: true, 
        subtree: true 
      });
      
      debugLog('Mutation observer set up');
    }
    
    /**
     * Intercept fetch and XMLHttpRequest
     */
    function setupFetchInterceptor() {
      // Override fetch
      const originalFetch = window.fetch;
      window.fetch = function(resource, init) {
        if (typeof resource === 'string') {
          const proxiedUrl = getProxiedUrl(resource);
          if (proxiedUrl !== resource) {
            debugLog('Fetch intercepted:', resource, '->', proxiedUrl);
            resource = proxiedUrl;
          }
        } else if (resource instanceof Request) {
          const url = resource.url;
          const proxiedUrl = getProxiedUrl(url);
          if (proxiedUrl !== url) {
            debugLog('Fetch Request intercepted:', url, '->', proxiedUrl);
            resource = new Request(proxiedUrl, resource);
          }
        }
        
        return originalFetch.call(this, resource, init);
      };
      
      // Override XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        const proxiedUrl = getProxiedUrl(url);
        if (proxiedUrl !== url) {
          debugLog('XMLHttpRequest intercepted:', url, '->', proxiedUrl);
          url = proxiedUrl;
        }
        
        return originalOpen.call(this, method, url, ...rest);
      };
      
      debugLog('Fetch and XHR interceptors set up');
    }
    
    // Initialize all interceptors
    function init() {
      debugLog('Initializing ProxyWarp client-side interceptors');
      overrideHistoryMethods();
      overrideLocationSetters();
      setupLinkClickInterceptor();
      setupMutationObserver();
      setupFetchInterceptor();
      debugLog('All interceptors initialized');
    }
    
    // Run initialization when the DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  </script>
    `;
  }
  
  module.exports = { generateClientScript };