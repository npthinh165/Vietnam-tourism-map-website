import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { SessionUser } from "../shared/travel.ts";
import { db } from "./db.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const memberSelect = {
  id: true,
  name: true,
  points: true,
  tier: true,
} as const;
export const userSelect = { ...memberSelect, email: true, role: true } as const;
export interface AuthState {
  user: SessionUser;
  tokenHash: string;
  csrf: string;
}
declare global {
  namespace Express {
    interface Request {
      auth?: AuthState;
    }
  }
}
export const cookieName =
  process.env.NODE_ENV === "production" ? "__Host-vntravel" : "vntravel";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export function readToken(req: Request) {
  const value = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export const csrfFor = (token: string) => hash(`vntravel-csrf:${token}`);
export const route =
  (
    handler: (req: Request, res: Response) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
export async function loadSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = readToken(req);
    if (token) {
      const session = await db.session.findUnique({
        where: { tokenHash: hash(token) },
        include: { user: { select: userSelect } },
      });
      if (session && session.expiresAt.getTime() > Date.now())
        req.auth = {
          user: session.user,
          tokenHash: session.tokenHash,
          csrf: csrfFor(token),
        };
    }
    next();
  } catch (error) {
    next(error);
  }
}
export function requireUser(req: Request) {
  if (!req.auth) throw new HttpError(401, "Vui lòng đăng nhập để tiếp tục.");
  return req.auth.user;
}
export function requireAdmin(req: Request) {
  const user = requireUser(req);
  if (user.role !== "ADMIN")
    throw new HttpError(403, "Tài khoản không có quyền quản trị.");
  return user;
}
export function requireCsrf(req: Request) {
  const user = requireUser(req),
    supplied = req.get("x-csrf-token") || "";
  if (
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(req.auth!.csrf))
  )
    throw new HttpError(
      403,
      "Phiên biểu mẫu đã thay đổi. Vui lòng tải lại trang.",
    );
  return user;
}
export async function rateLimit(
  scope: string,
  identity: string,
  max: number,
  windowMs: number,
) {
  const now = Date.now(),
    window = Math.floor(now / windowMs),
    key = hash(`${scope}:${identity}:${window}`);
  const expiresAt = new Date((window + 1) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateBucket"."count" + 1 RETURNING "count"`;
  if (rows[0].count > max)
    throw new HttpError(429, "Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
}
export function cursorQuery(query: Request["query"]) {
  const raw = query.cursor;
  if (raw === undefined) return undefined;
  try {
    if (typeof raw !== "string" || raw.length > 300) throw new Error();
    const value = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        value.id,
      ) ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt))
    )
      throw new Error();
    const date = new Date(value.createdAt);
    return {
      OR: [
        { createdAt: { lt: date } },
        { createdAt: date, id: { lt: value.id as string } },
      ],
    };
  } catch {
    throw new HttpError(400, "Con trỏ phân trang không hợp lệ.");
  }
}
export function page<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit = 20,
) {
  const items = rows.slice(0, limit),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ id: last.id, createdAt: last.createdAt }),
          ).toString("base64url")
        : null,
  };
}
export const newest = [{ createdAt: "desc" }, { id: "desc" }] as const;
