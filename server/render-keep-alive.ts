import http from 'http';

/**
 * This is a special keep-alive server for hosting on Render.com
 * It creates a simple HTTP server that responds to health checks.
 * This prevents Render from shutting down the service due to inactivity.
 */
export function setupRenderKeepAlive() {
  // Create a simple HTTP server for Render's health checks
  const keepAliveServer = http.createServer((req, res) => {
    // Respond with 200 OK and some info about the bot
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'Discord Bot',
      message: 'Bot is running'
    }));
  });

  // Listen on the port Render provides or fallback to 10000
  const port = process.env.PORT || 10000;
  keepAliveServer.listen(port, () => {
    console.log(`Render keep-alive server running on port ${port}`);
  });

  // Set up an interval to ping ourselves every 5 minutes
  // This helps to keep the bot alive on Render's free tier
  const selfPingInterval = 5 * 60 * 1000; // 5 minutes
  
  // Only set up self-ping if we're on Render (check for Render-specific env var)
  if (process.env.RENDER === 'true') {
    setInterval(() => {
      const pingUrl = `http://localhost:${port}`;
      http.get(pingUrl, (res) => {
        console.log(`Self-ping successful: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('Self-ping failed:', err);
      });
    }, selfPingInterval);
  }
}