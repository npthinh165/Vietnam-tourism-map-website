import express from "express";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { authRouter } from "./auth.ts";
import { adminRouter } from "./admin.ts";
import { apiRouter } from "./routes.ts";
import { HttpError, loadSession, route } from "./http.ts";
import { db } from "./db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function createApp() {
  const app = express();
  const production = process.env.NODE_ENV === "production";
  if (production && !process.env.APP_URL?.startsWith("https://"))
    throw new Error("APP_URL must be the public HTTPS origin in production.");
  const allowedOrigin = new URL(process.env.APP_URL || "http://localhost:3000")
    .origin;
  const allowedOrigins = new Set([allowedOrigin]);
  const localOrigin = new URL(allowedOrigin);
  if (
    !production &&
    ["localhost", "127.0.0.1"].includes(localOrigin.hostname)
  ) {
    localOrigin.hostname =
      localOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowedOrigins.add(localOrigin.origin);
  }
  app.disable("x-powered-by");
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          ...(production ? {} : { upgradeInsecureRequests: null }),
        },
      },
      strictTransportSecurity: production ? undefined : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.vary("Cookie");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        !allowedOrigins.has(req.get("origin") || "") ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return next(new HttpError(403, "Nguồn yêu cầu không được cho phép."));
      if (!/^application\/json(?:\s*;|$)/i.test(req.get("content-type") || ""))
        return next(new HttpError(415, "Yêu cầu cần có định dạng JSON."));
    }
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.get(
    "/api/health",
    route(async (_req, res) => {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    }),
  );
  app.use("/api", loadSession);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/v1", apiRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Không tìm thấy API." });
  });
  app.use(express.static(path.join(root, "dist"), { index: false }));
  app.use(express.static(path.join(root, "public"), { index: false }));
  app.get("*", (req, res) => {
    const index = path.join(root, "dist/index.html");
    if (req.accepts("html") && existsSync(index)) res.sendFile(index);
    else res.status(404).json({ error: "Không tìm thấy trang." });
  });
  const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      if (error.status === 429) res.set("Retry-After", "900");
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res.status(422).json({
        error: error.issues[0]?.message || "Dữ liệu không hợp lệ.",
        fields: error.flatten().fieldErrors,
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        error.code === "P2002" || error.code === "P2034"
          ? 409
          : ["P2003", "P2025"].includes(error.code)
            ? 404
            : 503;
      res.status(status).json({
        error:
          status === 409
            ? "Dữ liệu đã tồn tại hoặc vừa thay đổi. Vui lòng kiểm tra và thử lại."
            : status === 404
              ? "Nội dung không còn tồn tại."
              : "Dịch vụ dữ liệu tạm thời chưa sẵn sàng.",
      });
      return;
    }
    if (error.type === "entity.too.large") {
      res.status(413).json({ error: "Nội dung quá lớn." });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "JSON không hợp lệ." });
      return;
    }
    console.error("API error", { name: error.name, code: error.code });
    res
      .status(503)
      .json({ error: "Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại." });
  };
  app.use(errors);
  return app;
}
