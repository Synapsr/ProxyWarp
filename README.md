# ProxyWarp 🌀

> A transparent web proxy that brings any website to your domain using simple token subdomains.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

## ✨ Features

- 🔄 **Truly Transparent**: No content modification, shows websites exactly as they appear originally
- 🧩 **Framework Agnostic**: Works with Next.js, Nuxt.js, React, and all modern web technologies
- 🛡️ **Security Bypass**: Circumvents CORS, X-Frame-Options, and Content Security Policy restrictions
- 📦 **Simple Integration**: Embed any website in your application with a single iframe
- 🔑 **Short Token System**: Uses short, memorable tokens instead of complex encodings
- 🔀 **Smart Redirection**: Direct URL redirection using the `?url=` parameter
- 🚀 **Production-Ready**: Optimized for performance and scalability with minimal memory footprint

## 🔮 How It Works

ProxyWarp uses a smart token system to create clean, usable proxy URLs:

1. When you request a website, ProxyWarp generates a short token (e.g., `abc123`) for the domain
2. This token becomes a subdomain (e.g., `abc123.proxywarp.com`)
3. All requests to this subdomain are transparently proxied to the original site
4. Security headers that would prevent embedding are carefully removed
5. All resources (JS, CSS, images) are seamlessly proxied through the same system

## 🚀 Quick Start

### Using Docker

```bash
# Pull and run the Docker image
docker run -p 3000:3000 -e BASE_DOMAIN=your-domain.com synapsr/proxywarp
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/Synapsr/ProxyWarp.git
cd ProxyWarp

# Install dependencies
npm install

# Start the server
npm start
```

## ⚙️ Configuration

ProxyWarp is easily configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `BASE_DOMAIN` | Your base domain for the proxy | `proxywarp.com` |
| `DEBUG` | Enable detailed logging | `false` |
| `DB_FILE` | Path to token database file | `./data/tokens.json` |

## 📡 DNS Configuration

For production use, set up your DNS with:

1. An A record for your main domain:
   ```
   proxywarp.com  →  [YOUR_SERVER_IP]
   ```

2. A wildcard record for all subdomains:
   ```
   *.proxywarp.com  →  [YOUR_SERVER_IP]
   ```

## 🎯 Usage - 3 Easy Ways

### Method 1: Direct URL (NEW!)

Simply add your target URL as a query parameter to the homepage:

```
https://proxywarp.com/?url=https://example.com/path
```

This will automatically redirect you to the appropriate token-based URL, creating a new token if needed.

### Method 2: Token Subdomain

Use a token subdomain directly:

```
https://abc123.proxywarp.com/path
```

Where `abc123` is the token that maps to your desired website.

### Method 3: API Conversion

Convert URLs programmatically:

```javascript
// Client-side example
fetch('https://proxywarp.com/convert?url=https://example.com')
  .then(response => response.json())
  .then(data => {
    console.log(data.token);  // The generated token
    console.log(data.proxy);  // The full proxy URL
  });
```

## 🔄 Embedding in HTML

```html
<iframe 
  src="https://abc123.proxywarp.com" 
  width="100%" 
  height="600px"
  style="border: none;"
></iframe>
```

## 📝 API Reference

### Main Endpoints

- `GET /` - Home page with converter tool and documentation
- `GET /?url=[URL]` - Direct URL redirection (NEW!)
- `GET /convert?url=[URL]` - API to convert standard URLs to proxied versions
- `GET /test-token/[TOKEN]` - Test endpoint to verify token mappings (useful for debugging)

Response format for `/convert`:
```json
{
  "original": "https://example.com",
  "domain": "example.com",
  "token": "abc123",
  "proxy": "https://abc123.proxywarp.com"
}
```

## 🔍 Project Structure

ProxyWarp uses a modular architecture for better maintainability:

```
proxywarp/
├── config.js                   # Configuration settings
├── server.js                   # Main entry point
├── lib/                        # Core functionality
│   ├── proxyHandler.js         # Proxy middleware
│   ├── tokenStore.js           # Token management
│   └── utils.js                # Utility functions
├── routes/                     # Route handlers
│   ├── index.js                # Route definitions
│   └── templates/              # HTML templates
│       └── home.js             # Homepage template
└── data/                       # Data storage
    └── tokens.json             # Token database
```

## ⚠️ Limitations

- Some websites with sophisticated anti-proxy detection might not work perfectly
- WebSockets support requires additional configuration
- Very complex single-page applications might experience navigation issues
- Some features like PDF viewing may require special handling

## 🔐 Security Considerations

- ProxyWarp intentionally bypasses certain security controls to enable embedding
- Use responsibly and respect website terms of service
- Consider the privacy implications when proxying third-party content
- Not recommended for proxying sensitive data without additional security measures

## 🔧 Debugging

If you're experiencing issues:

1. Enable debug mode:
   ```
   DEBUG=true npm start
   ```

2. Test a specific token:
   ```
   GET https://proxywarp.com/test-token/abc123
   ```

3. In debug mode, you can view all active tokens:
   ```
   GET https://proxywarp.com/admin/tokens
   ```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) - Core proxy functionality
- [express](https://expressjs.com/) - Web framework
- [vhost](https://github.com/expressjs/vhost) - Virtual host middleware

---

🌀 **ProxyWarp** - Transparent proxy made simple