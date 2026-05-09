import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

// Import Twilio to trigger configuration logging
import "./twilio";

function runStartupMigrations() {
  // Fire-and-forget: runs in background so it never delays server startup
  (async () => {
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS public_site_enabled boolean NOT NULL DEFAULT true`);
        log("Startup migration: public_site_enabled column ensured");
        return;
      } catch (err: any) {
        const delay = Math.min(attempt * 5000, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    log("Startup migration: could not add public_site_enabled column after retries (non-fatal)");
  })();
}

const app = express();
// Stripe webhooks require the raw request body for signature verification, so
// the JSON parser is skipped for that path. Everything else goes through JSON.
const jsonParser = express.json({ limit: '50mb' });
const sendgridWebhookParser = express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
});
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') return next();
  if (req.originalUrl === '/api/webhooks/sendgrid/events') {
    return sendgridWebhookParser(req, res, next);
  }
  return jsonParser(req, res, next);
});
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
  runStartupMigrations(); // fire-and-forget, never blocks startup
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
