import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupRenderKeepAlive } from "./render-keep-alive";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Check environment and set environment flags
  const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;
  if (isRender) {
    console.log("Environment: Render");
    // Set the RENDER and IS_RENDER environment variables for consistency
    process.env.RENDER = 'true';
    process.env.IS_RENDER = 'true';
  } else {
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  }
  
  // Log if we're using in-memory or database mode
  const inMemoryMode = !process.env.DATABASE_URL;
  console.log(`Using database connection: ${inMemoryMode ? 'No (in-memory mode)' : 'Yes (URL defined)'}`);
  
  // Check database connection first
  try {
    const { checkDatabaseConnection } = await import("./db");
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      console.warn("⚠️ Could not verify database connection on startup. Will retry during operation.");
    } else {
      console.log("✅ Database connection verified on startup");
    }
  } catch (err) {
    console.error("❌ Database check failed:", err);
    console.warn("⚠️ Continuing startup despite database check failure");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error('Error caught by middleware:', err);
    // Don't throw the error again as it would cause an unhandled rejection
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use the port provided by the environment or default to 5000
  // For Render deployment, this will use the PORT environment variable
  // For local Replit deployment, it will use port 5000
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  // Add error handling for the server
  server.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use. Choose another port.`);
    } else {
      console.error('Server error:', err);
    }
    // Exit gracefully to allow the service to restart
    process.exit(1);
  });

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Setup Render keep-alive service if we're in production
    if (process.env.NODE_ENV === 'production') {
      setupRenderKeepAlive();
      log('Render keep-alive service initialized');
    }
  });
})();
