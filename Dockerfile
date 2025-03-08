FROM node:18-alpine

LABEL maintainer="Synapsr"
LABEL description="Transparent web proxy with Base64-encoded subdomains"

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag for smaller size
RUN npm ci --only=production && \
    npm cache clean --force

# Bundle app source
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S proxywarp && \
    adduser -u 1001 -S proxywarp -G proxywarp && \
    chown -R proxywarp:proxywarp /usr/src/app

# Switch to non-root user
USER proxywarp

# Expose the application port
EXPOSE 3000

# Healthcheck to verify app is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "proxy.js"]