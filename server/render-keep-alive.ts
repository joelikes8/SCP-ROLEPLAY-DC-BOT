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
  
  // Always set up self-ping in production, but especially for Render
  // We'll check for both production environment and Render-specific variables
  if (process.env.NODE_ENV === 'production') {
    console.log(`Setting up keep-alive pings (every ${selfPingInterval/1000}s) for production environment`);
    
    // Check if we're on Render specifically
    const isRender = process.env.RENDER === 'true' || process.env.RENDER === '1' || !!process.env.RENDER_EXTERNAL_URL;
    if (isRender) {
      console.log('Render-specific environment detected');
      // Set environment variable to help other parts of the app identify Render
      process.env.RENDER = 'true';
    }
    
    setInterval(() => {
      const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
      console.log(`Sending keep-alive ping to ${appUrl}`);
      http.get(appUrl, (res) => {
        console.log(`Self-ping successful: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('Self-ping failed:', err);
      });
    }, selfPingInterval);
  }
}