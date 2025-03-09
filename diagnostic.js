/**
 * ProxyWarp Diagnostic Tool
 * 
 * Outil pour diagnostiquer les problèmes de performance et de timeouts dans ProxyWarp.
 * 
 * Instructions:
 * 1. Sauvegardez ce fichier sous le nom "diagnostic.js" dans le répertoire racine de votre projet
 * 2. Exécutez-le avec Node.js: node diagnostic.js
 */

const http = require('http');
const https = require('https');
const dns = require('dns');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);
const fs = require('fs');
const path = require('path');

// Configuration - modifiez ces valeurs selon vos besoins
const config = {
  TARGET_DOMAINS: ['google.com', 'github.com', 'example.com'], // Domaines à tester
  PROXY_HOST: 'localhost', // Hôte du proxy
  PROXY_PORT: 3000, // Port du proxy
  TIMEOUT: 10000, // Timeout en ms
  TESTS_PER_DOMAIN: 3, // Nombre de tests par domaine
  OUTPUT_FILE: 'diagnostic-results.json' // Fichier de sortie
};

// Résultats des tests
const results = {
  timestamp: new Date().toISOString(),
  system: {
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    cpus: require('os').cpus().length
  },
  directTests: {},
  proxyTests: {},
  summary: {
    directSuccess: 0,
    directFailed: 0,
    proxySuccess: 0,
    proxyFailed: 0,
    timeouts: 0
  }
};

/**
 * Test direct de DNS pour un domaine
 */
async function testDns(domain) {
  console.log(`Testing DNS resolution for ${domain}...`);
  try {
    const start = Date.now();
    const result = await dnsLookup(domain);
    const time = Date.now() - start;
    
    return {
      success: true,
      ip: result.address,
      time: time
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test direct HTTP(S) pour un domaine
 */
async function testHttpDirect(domain, protocol = 'https') {
  console.log(`Testing direct ${protocol} connection to ${domain}...`);
  return new Promise((resolve) => {
    const start = Date.now();
    
    const options = {
      hostname: domain,
      port: protocol === 'https' ? 443 : 80,
      path: '/',
      method: 'GET',
      timeout: config.TIMEOUT,
      headers: {
        'User-Agent': 'ProxyWarp-Diagnostic/1.0'
      }
    };
    
    const req = (protocol === 'https' ? https : http).request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk.toString();
        // Limit data size
        if (data.length > 1000) {
          res.destroy();
        }
      });
      
      res.on('end', () => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          time: Date.now() - start,
          headers: res.headers,
          dataPreview: data.substring(0, 200) // Juste un aperçu
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        time: Date.now() - start,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        time: config.TIMEOUT,
        error: 'Timeout'
      });
    });
    
    req.end();
  });
}

/**
 * Test de connexion via le proxy
 */
async function testHttpProxy(domain, protocol = 'https') {
  console.log(`Testing proxy connection to ${domain} via ${protocol}...`);
  
  // Premier, obtenons un token pour le domaine
  let token;
  try {
    const tokenRes = await getProxyToken(domain);
    if (!tokenRes.success) {
      return {
        success: false,
        error: `Failed to get token: ${tokenRes.error}`
      };
    }
    token = tokenRes.token;
  } catch (error) {
    return {
      success: false,
      error: `Failed to get token: ${error.message}`
    };
  }
  
  // Maintenant testons la connexion proxy
  return new Promise((resolve) => {
    const start = Date.now();
    
    const options = {
      hostname: config.PROXY_HOST,
      port: config.PROXY_PORT,
      path: '/',
      method: 'GET',
      timeout: config.TIMEOUT,
      headers: {
        'Host': `${token}.${domain}`,
        'User-Agent': 'ProxyWarp-Diagnostic/1.0'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk.toString();
        // Limit data size
        if (data.length > 1000) {
          res.destroy();
        }
      });
      
      res.on('end', () => {
        resolve({
          success: res.statusCode < 400,
          statusCode: res.statusCode,
          time: Date.now() - start,
          headers: res.headers,
          dataPreview: data.substring(0, 200),
          token: token
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        time: Date.now() - start,
        error: error.message,
        token: token
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        time: config.TIMEOUT,
        error: 'Timeout',
        token: token
      });
    });
    
    req.end();
  });
}

/**
 * Obtiens un token pour un domaine via l'API
 */
async function getProxyToken(domain) {
  return new Promise((resolve) => {
    const options = {
      hostname: config.PROXY_HOST,
      port: config.PROXY_PORT,
      path: `/convert?url=https://${domain}`,
      method: 'GET',
      timeout: config.TIMEOUT
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.token) {
            resolve({
              success: true,
              token: result.token,
              domain: result.domain,
              proxy: result.proxy
            });
          } else {
            resolve({
              success: false,
              error: result.error || 'No token returned'
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse response: ${error.message}`
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout getting token'
      });
    });
    
    req.end();
  });
}

/**
 * Fonction principale pour exécuter tous les tests
 */
async function runDiagnostic() {
  console.log('Starting ProxyWarp diagnostics...');
  
  // Teste chaque domaine
  for (const domain of config.TARGET_DOMAINS) {
    results.directTests[domain] = {
      dns: await testDns(domain),
      http: [],
      https: []
    };
    
    results.proxyTests[domain] = {
      http: [],
      https: []
    };
    
    // Effectue plusieurs tests par protocole pour la fiabilité
    for (let i = 0; i < config.TESTS_PER_DOMAIN; i++) {
      // Tests directs
      const httpTest = await testHttpDirect(domain, 'http');
      const httpsTest = await testHttpDirect(domain, 'https');
      
      results.directTests[domain].http.push(httpTest);
      results.directTests[domain].https.push(httpsTest);
      
      // Mise à jour des statistiques
      if (httpTest.success) results.summary.directSuccess++;
      else results.summary.directFailed++;
      
      if (httpsTest.success) results.summary.directSuccess++;
      else results.summary.directFailed++;
      
      if (httpTest.error === 'Timeout' || httpsTest.error === 'Timeout') {
        results.summary.timeouts++;
      }
      
      // Tests via proxy
      const proxyHttpTest = await testHttpProxy(domain, 'http');
      const proxyHttpsTest = await testHttpProxy(domain, 'https');
      
      results.proxyTests[domain].http.push(proxyHttpTest);
      results.proxyTests[domain].https.push(proxyHttpsTest);
      
      // Mise à jour des statistiques
      if (proxyHttpTest.success) results.summary.proxySuccess++;
      else results.summary.proxyFailed++;
      
      if (proxyHttpsTest.success) results.summary.proxySuccess++;
      else results.summary.proxyFailed++;
      
      if (proxyHttpTest.error === 'Timeout' || proxyHttpsTest.error === 'Timeout') {
        results.summary.timeouts++;
      }
    }
  }
  
  // Calcule les statistiques agrégées
  calculateAggregateStats();
  
  // Affiche le résumé
  printSummary();
  
  // Sauvegarde les résultats
  fs.writeFileSync(config.OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Detailed results saved to ${config.OUTPUT_FILE}`);
}

/**
 * Calcule les statistiques agrégées des tests
 */
function calculateAggregateStats() {
  results.aggregateStats = {
    direct: {
      totalRequests: results.summary.directSuccess + results.summary.directFailed,
      successRate: (results.summary.directSuccess / (results.summary.directSuccess + results.summary.directFailed) * 100).toFixed(2) + '%',
      averageTimes: {}
    },
    proxy: {
      totalRequests: results.summary.proxySuccess + results.summary.proxyFailed,
      successRate: (results.summary.proxySuccess / (results.summary.proxySuccess + results.summary.proxyFailed) * 100).toFixed(2) + '%',
      averageTimes: {}
    },
    timeoutRate: (results.summary.timeouts / (results.summary.directSuccess + results.summary.directFailed + results.summary.proxySuccess + results.summary.proxyFailed) * 100).toFixed(2) + '%'
  };
  
  // Calcule les temps moyens par domaine et protocole
  for (const domain of config.TARGET_DOMAINS) {
    // Temps directs
    const directHttpTimes = results.directTests[domain].http
      .filter(test => test.success)
      .map(test => test.time);
    
    const directHttpsTime = results.directTests[domain].https
      .filter(test => test.success)
      .map(test => test.time);
    
    if (directHttpTimes.length > 0) {
      results.aggregateStats.direct.averageTimes[`${domain}-http`] = 
        (directHttpTimes.reduce((a, b) => a + b, 0) / directHttpTimes.length).toFixed(0) + 'ms';
    }
    
    if (directHttpsTime.length > 0) {
      results.aggregateStats.direct.averageTimes[`${domain}-https`] = 
        (directHttpsTime.reduce((a, b) => a + b, 0) / directHttpsTime.length).toFixed(0) + 'ms';
    }
    
    // Temps proxy
    const proxyHttpTimes = results.proxyTests[domain].http
      .filter(test => test.success)
      .map(test => test.time);
    
    const proxyHttpsTime = results.proxyTests[domain].https
      .filter(test => test.success)
      .map(test => test.time);
    
    if (proxyHttpTimes.length > 0) {
      results.aggregateStats.proxy.averageTimes[`${domain}-http`] = 
        (proxyHttpTimes.reduce((a, b) => a + b, 0) / proxyHttpTimes.length).toFixed(0) + 'ms';
    }
    
    if (proxyHttpsTime.length > 0) {
      results.aggregateStats.proxy.averageTimes[`${domain}-https`] = 
        (proxyHttpsTime.reduce((a, b) => a + b, 0) / proxyHttpsTime.length).toFixed(0) + 'ms';
    }
  }
}

/**
 * Affiche un résumé des résultats
 */
function printSummary() {
  console.log('\n======= DIAGNOSTIC SUMMARY =======');
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Node.js: ${results.system.nodeVersion}`);
  console.log(`Platform: ${results.system.platform}`);
  console.log(`Memory: ${Math.round(results.system.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(results.system.memory.heapTotal / 1024 / 1024)}MB`);
  console.log(`CPUs: ${results.system.cpus}`);
  
  console.log('\n--- DIRECT CONNECTIONS ---');
  console.log(`Success rate: ${results.aggregateStats.direct.successRate}`);
  
  for (const domain of config.TARGET_DOMAINS) {
    console.log(`\n${domain}:`);
    console.log(`  DNS: ${results.directTests[domain].dns.success ? 'SUCCESS' : 'FAILED'} (${results.directTests[domain].dns.time || 'N/A'}ms)`);
    
    const httpSuccessCount = results.directTests[domain].http.filter(t => t.success).length;
    const httpsSuccessCount = results.directTests[domain].https.filter(t => t.success).length;
    
    console.log(`  HTTP: ${httpSuccessCount}/${config.TESTS_PER_DOMAIN} successful`);
    console.log(`  HTTPS: ${httpsSuccessCount}/${config.TESTS_PER_DOMAIN} successful`);
  }
  
  console.log('\n--- PROXY CONNECTIONS ---');
  console.log(`Success rate: ${results.aggregateStats.proxy.successRate}`);
  
  for (const domain of config.TARGET_DOMAINS) {
    console.log(`\n${domain}:`);
    
    const proxyHttpSuccessCount = results.proxyTests[domain].http.filter(t => t.success).length;
    const proxyHttpsSuccessCount = results.proxyTests[domain].https.filter(t => t.success).length;
    
    console.log(`  HTTP: ${proxyHttpSuccessCount}/${config.TESTS_PER_DOMAIN} successful`);
    console.log(`  HTTPS: ${proxyHttpsSuccessCount}/${config.TESTS_PER_DOMAIN} successful`);
  }
  
  console.log('\n--- TIMING STATS ---');
  console.log(`Timeout rate: ${results.aggregateStats.timeoutRate}`);
  
  console.log('\nAverage response times (direct):');
  Object.entries(results.aggregateStats.direct.averageTimes).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  console.log('\nAverage response times (proxy):');
  Object.entries(results.aggregateStats.proxy.averageTimes).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  console.log('\n===================================');
}

// Exécute le diagnostic
runDiagnostic().catch(error => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});