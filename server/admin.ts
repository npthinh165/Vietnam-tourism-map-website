import { Router } from "express";
import { db } from "./db.ts";
import { z } from "zod";
import { placeSchema, placeUpdateSchema } from "../shared/places.ts";
import { managedPlace } from "./places.ts";
import {
  cursorQuery,
  newest,
  page,
  requireAdmin,
  requireCsrf,
  rateLimit,
  HttpError,
  route,
  userSelect,
} from "./http.ts";

export const adminRouter = Router();
adminRouter.use((req, _res, next) => {
  try {
    requireAdmin(req);
    if (!["GET", "HEAD"].includes(req.method)) {
      const user = requireCsrf(req);
      void rateLimit("admin-write", user.id, 100, 60_000).then(
        () => next(),
        next,
      );
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});
adminRouter.get(
  "/places",
  route(async (_req, res) => {
    res.json(
      (await db.place.findMany({ orderBy: { id: "desc" } })).map(managedPlace),
    );
  }),
);
adminRouter.post(
  "/places",
  route(async (req, res) => {
    const input = placeSchema.parse(req.body);
    const place = await db.place.create({ data: input });
    res.status(201).json(managedPlace(place));
  }),
);
adminRouter.put(
  "/places/:id",
  route(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { version, ...input } = placeUpdateSchema.parse(req.body);
    const saved = await db.place.updateMany({
      where: { id, version },
      data: { ...input, version: { increment: 1 } },
    });
    if (!saved.count)
      throw new HttpError(
        409,
        "Địa điểm đã thay đổi hoặc không còn tồn tại. Hãy tải lại trước khi sửa.",
      );
    res.json(managedPlace(await db.place.findUniqueOrThrow({ where: { id } })));
  }),
);
adminRouter.get(
  "/overview",
  route(async (_req, res) => {
    const [users, posts, reviews, itineraries, places] = await Promise.all([
      db.user.count(),
      db.post.count(),
      db.review.count(),
      db.itinerary.count(),
      db.place.count(),
    ]);
    res.json({ users, posts, reviews, itineraries, places });
  }),
);
adminRouter.get(
  "/users",
  route(async (req, res) => {
    const users = await db.user.findMany({
      where: cursorQuery(req.query),
      select: { ...userSelect, createdAt: true },
      orderBy: [...newest],
      take: 21,
    });
    res.json(page(users));
  }),
);
