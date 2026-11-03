import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getCorsOrigins } from "./lib/config.js";
import { isReadOnlyMigrationPreview } from "./lib/migrationMode.js";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const corsOrigins = getCorsOrigins();
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin is not allowed"));
    },
  }),
);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use((req, res, next) => {
  // Text e'raab is stateless: its existing JWT/account checks only read the DB.
  // This exact exception does not authorize sign-in or any stored-data mutation.
  const statelessIrab = req.method === "POST" && req.path === "/api/irab/text";
  if (isReadOnlyMigrationPreview() && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !statelessIrab) {
    res.status(423).json({
      message: "This migration preview is read-only. Changes and sign-in are disabled until live operations are approved.",
    });
    return;
  }
  next();
});

app.use("/api", router);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err as { type?: string; message?: string };
  if (error.type === "entity.too.large") {
    res.status(413).json({ message: "Request body is too large" });
    return;
  }
  if (error.message === "CORS origin is not allowed") {
    res.status(403).json({ message: "Origin is not allowed" });
    return;
  }
  req.log.error({ err: error.message }, "Unhandled request error");
  res.status(500).json({ message: "Internal server error" });
});

export default app;
