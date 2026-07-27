import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";
import { redirectMiddleware } from "./redirects";

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
        break;
      } catch (err: any) {
        const delay = Math.min(attempt * 5000, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // url_redirects table
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS url_redirects (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            source_path text NOT NULL,
            source_host text,
            target_path text NOT NULL,
            status_code integer NOT NULL DEFAULT 301,
            match_type text NOT NULL DEFAULT 'exact',
            active boolean NOT NULL DEFAULT true,
            notes text,
            hit_count integer NOT NULL DEFAULT 0,
            last_hit_at timestamp,
            created_at timestamp NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_url_redirects_source ON url_redirects(source_path)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_url_redirects_active ON url_redirects(active)`);
        await pool.query(`ALTER TABLE url_redirects ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'exact'`);
        log("Startup migration: url_redirects table ensured");
        break;
      } catch (err: any) {
        const delay = Math.min(attempt * 5000, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // photos: storage_provider + SPE columns
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pool.query(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'wix'`);
        await pool.query(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS sp_container_id text`);
        await pool.query(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS sp_folder_path text`);
        // Backfill any rows that somehow ended up NULL (shouldn't happen with DEFAULT, but be safe)
        await pool.query(`UPDATE photos SET storage_provider = 'wix' WHERE storage_provider IS NULL`);
        log("Startup migration: photos storage_provider + SPE columns ensured");
        break;
      } catch (err: any) {
        const delay = Math.min(attempt * 5000, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // not_found_logs table
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS not_found_logs (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            path text NOT NULL UNIQUE,
            hit_count integer NOT NULL DEFAULT 1,
            last_referrer text,
            last_user_agent text,
            resolved boolean NOT NULL DEFAULT false,
            notes text,
            first_seen_at timestamp NOT NULL DEFAULT NOW(),
            last_seen_at timestamp NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_not_found_logs_path ON not_found_logs(path)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_not_found_logs_hit_count ON not_found_logs(hit_count)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_not_found_logs_resolved ON not_found_logs(resolved)`);
        log("Startup migration: not_found_logs table ensured");
        break;
      } catch (err: any) {
        const delay = Math.min(attempt * 5000, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
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

  // URL redirect middleware runs after API routes but before the SPA catch-all
  app.use(redirectMiddleware);

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
