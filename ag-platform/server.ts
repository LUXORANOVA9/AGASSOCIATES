import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import caseRoutes from "./src/server/routes/cases.ts";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We'll import AI API routes from another file to keep it clean
import aiRoutes from "./src/server/aiRouter.ts";
import { pool } from "./src/server/db.ts";

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
  const PORT = 3000;

  await runMigrations();

  // Add trust proxy for rate limiting behind a reverse proxy
  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json());

  // Rate Limiting for AI Routes
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: "Too many requests to AI services, please try again later.",
    validate: { xForwardedForHeader: false, trustProxy: false, keyGeneratorIpFallback: false, default: true },
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

  app.use("/api", caseRoutes);

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
