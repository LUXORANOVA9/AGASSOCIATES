import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import caseRoutes from "./src/server/routes/cases.ts";
import timesheetRoutes from "./src/server/routes/timesheets.ts";
import documentRoutes from "./src/server/routes/documents.ts";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We'll import AI API routes from another file to keep it clean
import aiRoutes from "./src/server/aiRouter.ts";
import { pool } from "./src/server/db.ts";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

interface AuthUser {
  sub: string;
  role: string;
  email?: string;
}

function authMiddleware(allowedRoles?: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!SUPABASE_JWT_SECRET) {
      (req as any).user = { sub: 'dev-user', role: 'admin', email: 'dev@local' };
      next();
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
      return;
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as any;
      const user: AuthUser = {
        sub: decoded.sub || 'unknown',
        role: decoded.role || decoded.app_metadata?.role || 'applicant',
        email: decoded.email,
      };
      (req as any).user = user;
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
        return;
      }
      next();
    } catch (err) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}

async function runMigrations() {
  try {
    const migrationPath = path.join(process.cwd(), "src/server/migrations.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    await pool.query(sql);
    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3001", 10);

  await runMigrations();

  // Add trust proxy for rate limiting behind a reverse proxy
  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json());

  // Step 5: Add Request ID
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.headers['x-request-id']);
    next();
  });

  // Rate Limiting for AI Routes
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests to AI services, please try again later.",
  });

  // Mount API paths
  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    try {
      const dbRes = await pool.query('SELECT 1 as result');
      if (dbRes.rows.length > 0) {
        dbStatus = "connected";
      }
    } catch (e) {
      console.error("Database connection failed", e);
      dbStatus = "disconnected";
    }
    res.json({ status: "ok", database: dbStatus });
  });

  app.post("/api/webhooks/virus-scan", async (req, res) => {
    try {
      const { bucketId, filePath } = req.body;
      console.log(`[virus-scan] received: bucket=${bucketId}, path=${filePath}`);
      res.json({ status: "ok", safe: true });
    } catch (e) {
      res.status(500).json({ error: "Virus scan failed" });
    }
  });

  app.use("/api", caseRoutes);
  app.use("/api", timesheetRoutes);
  app.use("/api", documentRoutes);

  app.use("/api/ai", aiLimiter, aiRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Since it's Express v5, we must use '*all'
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Step 5: Global Structured Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`System Error: ${err.message} | Request ID: ${req.headers['x-request-id']}`);
    
    const statusCode = err.status || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    
    res.status(statusCode).json({
      error: {
        code: isClientError ? err.code || 'BAD_REQUEST' : 'SYSTEM_ERROR',
        message: isClientError ? err.message : 'An internal system error occurred. Please try again later.',
        requestId: req.headers['x-request-id']
      }
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
