import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { signupSchema, loginSchema } from "../shared/travel.ts";
import { db, transaction } from "./db.ts";
import { awardPoints } from "./rewards.ts";
import {
  cookieName,
  cookieOptions,
  csrfFor,
  hash,
  HttpError,
  rateLimit,
  readToken,
  requireCsrf,
  route,
  userSelect,
} from "./http.ts";

const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);
const lifetime = 7 * 24 * 3600_000;
export const authRouter = Router();
authRouter.get(
  "/session",
  route(async (req, res) => {
    res.json({
      user: req.auth?.user || null,
      csrfToken: req.auth?.csrf || null,
    });
  }),
);
authRouter.post(
  "/signup",
  route(async (req, res) => {
    await rateLimit("signup", req.ip || "unknown", 5, 3600_000);
    const input = signupSchema.parse(req.body),
      passwordHash = await bcrypt.hash(input.password, 12);
    const token = randomBytes(32).toString("hex");
    const user = await transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await awardPoints(tx, created.id, "SIGNUP", created.id);
      await tx.session.create({
        data: {
          tokenHash: hash(token),
          userId: created.id,
          expiresAt: new Date(Date.now() + lifetime),
        },
      });
      const previous = readToken(req);
      if (previous)
        await tx.session.deleteMany({ where: { tokenHash: hash(previous) } });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: userSelect,
      });
    }).catch((error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new HttpError(
          409,
          "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.",
        );
      throw error;
    });
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime });
    res.status(201).json({ user, csrfToken: csrfFor(token) });
  }),
);
authRouter.post(
  ["/signin", "/admin/signin"],
  route(async (req, res) => {
    await rateLimit("signin-ip", req.ip || "unknown", 30, 15 * 60_000);
    const input = loginSchema.parse(req.body);
    await rateLimit("signin-email", input.email, 10, 15 * 60_000);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const matches = await bcrypt.compare(
      input.password,
      user?.passwordHash || (await dummyHash),
    );
    if (!matches || !user)
      throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
    if (req.path === "/admin/signin" && user.role !== "ADMIN")
      throw new HttpError(
        403,
        "Tài khoản không có quyền quản trị. Vui lòng đăng nhập dành cho thành viên.",
      );
    const token = randomBytes(32).toString("hex");
    await transaction(async (tx) => {
      const previous = readToken(req);
      if (previous)
        await tx.session.deleteMany({ where: { tokenHash: hash(previous) } });
      await tx.session.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      });
      const excess = await tx.session.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: 4,
      });
      await tx.session.deleteMany({
        where: { tokenHash: { in: excess.map((s) => s.tokenHash) } },
      });
      await tx.session.create({
        data: {
          tokenHash: hash(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + lifetime),
        },
      });
    });
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime });
    res.json({
      user: await db.user.findUnique({
        where: { id: user.id },
        select: userSelect,
      }),
      csrfToken: csrfFor(token),
    });
  }),
);
authRouter.post(
  "/signout",
  route(async (req, res) => {
    if (req.auth) {
      requireCsrf(req);
      await db.session.deleteMany({ where: { tokenHash: req.auth.tokenHash } });
    }
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  }),
);
