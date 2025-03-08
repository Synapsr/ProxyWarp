# ProxyWarp 🌀

> A transparent web proxy that warps any website to your domain using Base64-encoded subdomains.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

## ✨ Features

- 🔄 **Truly Transparent**: No content modification, shows websites exactly as they appear originally
- 🧩 **Framework Agnostic**: Works with Next.js, Nuxt.js, React, and all modern web technologies
- 🛡️ **Security Bypass**: Circumvents CORS, X-Frame-Options, and Content Security Policy restrictions
- 📦 **Simple Integration**: Embed any website in your application with a single iframe
- 🔐 **Clean URL Structure**: Uses Base64-encoded subdomains for a seamless experience
- 🚀 **Production-Ready**: Optimized for performance and scalability with minimal memory footprint

## 🔮 How It Works

ProxyWarp uses an elegant approach to proxy websites:

1. It encodes the target domain in Base64 (e.g., `example.com` → `ZXhhbXBsZS5jb20=`)
2. This encoded string becomes a subdomain of your proxy domain (e.g., `ZXhhbXBsZS5jb20=.proxywarp.com`)
3. When a request hits this subdomain, ProxyWarp decodes it and forwards the request to the original site
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

## 🎯 Usage Examples

### Basic Access

To visit any website through the proxy:

```
https://[BASE64_ENCODED_DOMAIN].proxywarp.com
```

For example, to access `github.com`:

```
https://Z2l0aHViLmNvbQ==.proxywarp.com
```

### Embedding in HTML

```html
<iframe 
  src="https://Z2l0aHViLmNvbQ==.proxywarp.com" 
  width="100%" 
  height="600px"
  style="border: none;"
></iframe>
```

### Using the Conversion API

Convert URLs programmatically:

```javascript
// Client-side example
fetch('https://proxywarp.com/convert?url=https://example.com')
  .then(response => response.json())
  .then(data => {
    console.log(data.proxy); // The proxied URL to use
  });
```


## 📝 API Reference

### Main Endpoints

- `GET /` - Home page with converter tool
- `GET /convert?url=[URL]` - API to convert standard URLs to proxied versions

Response format:
```json
{
  "original": "https://example.com",
  "encodedDomain": "ZXhhbXBsZS5jb20=",
  "proxy": "https://ZXhhbXBsZS5jb20=.proxywarp.com"
}
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

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) - Core proxy functionality
- [express](https://expressjs.com/) - Web framework
- [vhost](https://github.com/expressjs/vhost) - Virtual host middleware

---

🌀 **ProxyWarp** - Warp the web to your domain