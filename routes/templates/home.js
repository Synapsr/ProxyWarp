/**
 * Home Page Template
 * 
 * Renders the home page HTML content.
 */

/**
 * Generates home page HTML
 * 
 * @param {Array} examples - Example domains and tokens
 * @param {string} baseDomain - Base domain for the proxy
 * @returns {string} - HTML for home page
 */
function homeTemplate(examples, baseDomain) {
    // Generate example rows
    const exampleRows = examples.map(example => `
      <tr>
        <td>${example.domain}</td>
        <td><code>${example.token}</code></td>
        <td><a href="https://${example.token}.${baseDomain}" target="_blank">https://${example.token}.${baseDomain}</a></td>
      </tr>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ProxyWarp - Token-Based Transparent Web Proxy</title>
          <style>
            :root {
              --primary: #3182ce;
              --primary-dark: #2c5282;
              --accent: #ecc94b;
              --text: #2d3748;
              --light-bg: #f7fafc;
              --border: #e2e8f0;
            }
            
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              line-height: 1.6;
              color: var(--text);
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            
            h1, h2, h3 {
              color: var(--primary-dark);
            }
            
            h1 {
              border-bottom: 2px solid var(--accent);
              padding-bottom: 10px;
              margin-bottom: 1.5rem;
            }
            
            code {
              background: var(--light-bg);
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-family: SFMono-Regular, Consolas, Menlo, monospace;
              font-size: 0.9em;
            }
            
            .example {
              background: var(--light-bg);
              padding: 15px;
              border-left: 4px solid var(--primary);
              margin: 20px 0;
              border-radius: 0 4px 4px 0;
            }
            
            input[type="url"] {
              width: 100%;
              max-width: 500px;
              padding: 8px 12px;
              border: 1px solid var(--border);
              border-radius: 4px;
              font-size: 16px;
            }
            
            button {
              background-color: var(--primary);
              color: white;
              border: none;
              padding: 8px 15px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              transition: background-color 0.2s;
            }
            
            button:hover {
              background-color: var(--primary-dark);
            }
            
            .conversion-result {
              display: none;
              margin-top: 15px;
              padding: 15px;
              background: #ebf8ff;
              border-radius: 5px;
              border-left: 4px solid var(--primary);
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            table th, table td {
              padding: 10px;
              border: 1px solid var(--border);
              text-align: left;
            }
            
            table th {
              background: var(--light-bg);
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 10px;
              border-top: 1px solid var(--border);
              font-size: 0.9em;
              color: #718096;
            }
            
            .method-title {
              background: var(--light-bg);
              padding: 10px;
              margin-top: 20px;
              border-radius: 4px;
              font-weight: bold;
            }
            
            .url-field {
              margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <h1>ProxyWarp</h1>
          <p>Access any website through a transparent proxy using short token subdomains.</p>
          
          <h2>How to Use</h2>
          
          <div class="method-title">Method 1: Direct URL</div>
          <p>Simply append <code>?url=</code> and your desired URL to the homepage:</p>
          <div class="example">
            <code>https://${baseDomain}/?url=https://example.com/some/path</code>
          </div>
          <p>This will automatically redirect you to the appropriate token-based proxy URL.</p>
          
          <div class="method-title">Method 2: Token Subdomain</div>
          <p>Use a token subdomain to access websites:</p>
          <div class="example">
            <code>https://[TOKEN].${baseDomain}</code>
          </div>
          
          <h2>Examples</h2>
          <table>
            <thead>
              <tr>
                <th>Website</th>
                <th>Token</th>
                <th>Proxy URL</th>
              </tr>
            </thead>
            <tbody>
              ${exampleRows}
            </tbody>
          </table>
          
          <h2>URL Conversion Tool</h2>
          <p>Convert any URL to get its token and proxied version:</p>
          
          <div id="converter">
            <div class="form-group url-field">
              <input type="url" id="url-input" placeholder="https://example.com" required>
              <button id="convert-btn">Generate Proxy URL</button>
            </div>
            
            <div id="result" class="conversion-result">
              <div>
                <strong>Original URL:</strong>
                <span id="original-url"></span>
              </div>
              <div>
                <strong>Token:</strong>
                <span id="token-result"></span>
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
                document.getElementById('token-result').textContent = data.token;
                
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
    `;
  }
  
  module.exports = homeTemplate;