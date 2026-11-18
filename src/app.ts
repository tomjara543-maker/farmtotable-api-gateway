import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt, { JwtPayload } from "jsonwebtoken";
import { metricsHandler, metricsMiddleware } from "./metrics";

export interface Identity {
  id: string;
  role: string;
}

export function resolveIdentity(authorization: string | undefined, secret: string): Identity | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const payload = jwt.verify(authorization.slice(7), secret) as JwtPayload;
  if (!payload.sub || !payload.role) throw new Error("payload incompleto");
  return { id: payload.sub, role: String(payload.role) };
}

function originAllowed(patterns: string[]) {
  const regexes = patterns.map(
    (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]*")}$`, "i"),
  );
  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
    cb(null, !origin || regexes.some((r) => r.test(origin)));
}

const serviceRoutes =() => [
  { prefix: "/api/producers", target: process.env.PRODUCER_SERVICE_URL ?? "http://localhost:4001" },
  { prefix: "/api/products", target: process.env.CATALOG_SERVICE_URL ?? "http://localhost:4002" },
  { prefix: "/api/orders", target: process.env.ORDER_SERVICE_URL ?? "http://localhost:4003" },
  { prefix: "/api/carts", target: process.env.ORDER_SERVICE_URL ?? "http://localhost:4003" },
  { prefix: "/api/inventory", target: process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4004" },
  { prefix: "/api/deliveries", target: process.env.LOGISTICS_SERVICE_URL ?? "http://localhost:4005" },
  { prefix: "/api/payments", target: process.env.PAYMENT_SERVICE_URL ?? "http://localhost:4006" },
  { prefix: "/api/notifications", target: process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4007" },
  { prefix: "/api/analytics", target: process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:4008" },
  { prefix: "/api/auth", target: process.env.AUTH_SERVICE_URL ?? "http://localhost:4009" },
  { prefix: "/api/pricing", target: process.env.PRICING_SERVICE_URL ?? "http://localhost:4010" },
];

export function createApp() {
  const JWT_SECRET = process.env.JWT_SECRET ?? "";
  const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "";
  if (!JWT_SECRET) throw new Error("Falta la variable JWT_SECRET (debe ser igual a la de auth-service)");

  const app = express();
  app.set("trust proxy", 1);
  app.use(metricsMiddleware);
  app.get("/metrics", metricsHandler);
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: originAllowed(allowedOrigins) }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/health", (_req, res) => res.json({ service: "api-gateway", status: "ok" }));

  app.use((req, res, next) => {
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];
    delete req.headers["x-internal-token"];
    if (INTERNAL_TOKEN) req.headers["x-internal-token"] = INTERNAL_TOKEN;

    try {
      const identity = resolveIdentity(req.header("authorization"), JWT_SECRET);
      if (identity) {
        req.headers["x-user-id"] = identity.id;
        req.headers["x-user-role"] = identity.role;
      }
      next();
    } catch {
      res.status(401).json({ error: "Token inválido o expirado" });
    }
  });

  for (const { prefix, target } of serviceRoutes()) {
    app.use(
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathFilter: prefix,
        pathRewrite: { "^/api": "" },
      }),
    );
  }

  app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada en el gateway" }));
  return app;
}
