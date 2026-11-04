import { Router } from "express";
import { z } from "zod";
import {
  checkInSchema,
  commentSchema,
  distanceMeters,
  itinerarySchema,
  postSchema,
  reviewSchema,
  vietnamDay,
} from "../shared/travel.ts";
import { db, transaction } from "./db.ts";
import { currentProvinceId } from "../shared/provinces.ts";
import { awardPoints } from "./rewards.ts";
import { managedPlace } from "./places.ts";
import {
  cursorQuery,
  HttpError,
  memberSelect,
  newest,
  page,
  rateLimit,
  requireCsrf,
  requireUser,
  route,
} from "./http.ts";

export const apiRouter = Router();
apiRouter.get(
  "/places",
  route(async (_req, res) => {
    res.json(
      (await db.place.findMany({ orderBy: { id: "asc" } })).map(managedPlace),
    );
  }),
);
const uuid = (id: unknown) => z.string().uuid().parse(id);
const placeId = (id: unknown) => z.coerce.number().int().positive().parse(id);
const planInclude = {
  author: { select: memberSelect },
  days: {
    orderBy: { day: "asc" as const },
    include: { activities: { orderBy: { position: "asc" as const } } },
  },
};
const nestedDays = (days: z.infer<typeof itinerarySchema>["days"]) =>
  days.map((d, i) => ({
    day: i + 1,
    title: d.title,
    activities: {
      create: [...d.activities]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((a, position) => ({ ...a, position })),
    },
  }));
apiRouter.use((req, res, next) => {
  if (["GET", "HEAD"].includes(req.method)) return next();
  try {
    const user = requireCsrf(req);
    void rateLimit("write", user.id, 100, 60_000).then(() => next(), next);
  } catch (error) {
    next(error);
  }
});
apiRouter.get(
  "/rewards",
  route(async (req, res) => {
    const user = requireUser(req);
    const entries = await db.pointEntry.findMany({
      where: { userId: user.id, ...cursorQuery(req.query) },
      orderBy: [...newest],
      take: 21,
    });
    res.json({ ...page(entries), user });
  }),
);
apiRouter.patch(
  "/profile",
  route(async (req, res) => {
    const input = z
      .object({ name: z.string().trim().min(2).max(80) })
      .strict()
      .parse(req.body);
    res.json(
      await db.user.update({
        where: { id: requireUser(req).id },
        data: input,
        select: memberSelect,
      }),
    );
  }),
);
apiRouter.get(
  "/posts",
  route(async (req, res) => {
    const rows = await db.post.findMany({
      where: cursorQuery(req.query),
      orderBy: [...newest],
      take: 21,
      include: {
        author: { select: memberSelect },
        _count: { select: { likes: true, comments: true } },
        likes: {
          where: {
            userId: req.auth?.user.id || "00000000-0000-0000-0000-000000000000",
          },
          select: { userId: true },
        },
      },
    });
    const result = page(rows);
    res.json({
      ...result,
      items: result.items.map(({ _count, likes, ...p }) => ({
        ...p,
        imageUrl: p.imageUrl || "",
        liked: likes.length > 0,
        likeCount: _count.likes,
        commentCount: _count.comments,
      })),
    });
  }),
);
apiRouter.post(
  "/posts",
  route(async (req, res) => {
    const input = postSchema.parse(req.body);
    res.status(201).json(
      await db.post.create({
        data: { ...input, authorId: requireUser(req).id },
      }),
    );
  }),
);
apiRouter.patch(
  "/posts/:id",
  route(async (req, res) => {
    const input = postSchema.parse(req.body);
    const result = await db.post.updateMany({
      where: { id: uuid(req.params.id), authorId: requireUser(req).id },
      data: input,
    });
    if (!result.count)
      throw new HttpError(404, "Không tìm thấy bài viết của bạn.");
    res.status(204).end();
  }),
);
apiRouter.delete(
  "/posts/:id",
  route(async (req, res) => {
    const result = await db.post.deleteMany({
      where: { id: uuid(req.params.id), authorId: requireUser(req).id },
    });
    if (!result.count)
      throw new HttpError(404, "Không tìm thấy bài viết của bạn.");
    res.status(204).end();
  }),
);
apiRouter.put(
  "/posts/:id/like",
  route(async (req, res) => {
    const postId = uuid(req.params.id),
      userId = requireUser(req).id;
    const { liked } = z.object({ liked: z.boolean() }).strict().parse(req.body);
    const result = await transaction(async (tx) => {
      if (
        !(await tx.post.findUnique({
          where: { id: postId },
          select: { id: true },
        }))
      )
        throw new HttpError(404, "Bài viết đã bị xóa.");
      if (liked)
        await tx.like.createMany({
          data: [{ userId, postId }],
          skipDuplicates: true,
        });
      else await tx.like.deleteMany({ where: { userId, postId } });
      return { liked, likeCount: await tx.like.count({ where: { postId } }) };
    });
    res.json(result);
  }),
);
apiRouter.get(
  "/posts/:id/comments",
  route(async (req, res) => {
    const postId = uuid(req.params.id);
    if (!(await db.post.findUnique({ where: { id: postId } })))
      throw new HttpError(404, "Bài viết đã bị xóa.");
    res.json(
      page(
        await db.comment.findMany({
          where: { postId, ...cursorQuery(req.query) },
          include: { author: { select: memberSelect } },
          orderBy: [...newest],
          take: 21,
        }),
      ),
    );
  }),
);
apiRouter.post(
  "/posts/:id/comments",
  route(async (req, res) => {
    const input = commentSchema.parse(req.body);
    res.status(201).json(
      await db.comment.create({
        data: {
          ...input,
          postId: uuid(req.params.id),
          authorId: requireUser(req).id,
        },
        include: { author: { select: memberSelect } },
      }),
    );
  }),
);
apiRouter.patch(
  "/comments/:id",
  route(async (req, res) => {
    const result = await db.comment.updateMany({
      where: { id: uuid(req.params.id), authorId: requireUser(req).id },
      data: commentSchema.parse(req.body),
    });
    if (!result.count)
      throw new HttpError(404, "Không tìm thấy bình luận của bạn.");
    res.status(204).end();
  }),
);
apiRouter.delete(
  "/comments/:id",
  route(async (req, res) => {
    const result = await db.comment.deleteMany({
      where: { id: uuid(req.params.id), authorId: requireUser(req).id },
    });
    if (!result.count)
      throw new HttpError(404, "Không tìm thấy bình luận của bạn.");
    res.status(204).end();
  }),
);
apiRouter.get(
  "/itineraries",
  route(async (req, res) => {
    const mine = req.query.mine === "true";
    const where = mine
      ? { authorId: requireUser(req).id }
      : { visibility: "PUBLIC" as const };
    res.json(
      page(
        await db.itinerary.findMany({
          where: { ...where, ...cursorQuery(req.query) },
          include: planInclude,
          orderBy: [...newest],
          take: 21,
        }),
      ),
    );
  }),
);
apiRouter.get(
  "/itineraries/:id",
  route(async (req, res) => {
    const plan = await db.itinerary.findFirst({
      where: {
        id: uuid(req.params.id),
        OR: [
          { visibility: "PUBLIC" },
          ...(req.auth ? [{ authorId: req.auth.user.id }] : []),
        ],
      },
      include: planInclude,
    });
    if (!plan) throw new HttpError(404, "Không tìm thấy lịch trình.");
    res.json(plan);
  }),
);
apiRouter.post(
  "/itineraries",
  route(async (req, res) => {
    const { id, ...input } = itinerarySchema
        .extend({ id: z.string().uuid() })
        .parse(req.body),
      userId = requireUser(req).id;
    const result = await transaction(async (tx) => {
      const existing = await tx.itinerary.findUnique({
        where: { id },
        include: planInclude,
      });
      if (existing) {
        if (existing.authorId !== userId)
          throw new HttpError(409, "Mã lịch trình đã được sử dụng.");
        return existing;
      }
      const { days, ...fields } = input;
      const plan = await tx.itinerary.create({
        data: {
          id,
          ...fields,
          authorId: userId,
          days: { create: nestedDays(days) },
        },
        include: planInclude,
      });
      await awardPoints(tx, userId, "ITINERARY", plan.id);
      return plan;
    });
    res.status(201).json(result);
  }),
);
apiRouter.put(
  "/itineraries/:id",
  route(async (req, res) => {
    const { version, days, ...input } = itinerarySchema
      .extend({ version: z.number().int().positive() })
      .parse(req.body);
    const id = uuid(req.params.id),
      authorId = requireUser(req).id;
    const plan = await transaction(async (tx) => {
      const updated = await tx.itinerary.updateMany({
        where: { id, authorId, version },
        data: { ...input, version: { increment: 1 } },
      });
      if (!updated.count) {
        if (!(await tx.itinerary.findFirst({ where: { id, authorId } })))
          throw new HttpError(404, "Không tìm thấy lịch trình của bạn.");
        throw new HttpError(
          409,
          "Lịch trình đã thay đổi ở tab khác. Hãy tải lại bản mới trước khi sửa.",
        );
      }
      await tx.itineraryDay.deleteMany({ where: { itineraryId: id } });
      return tx.itinerary.update({
        where: { id },
        data: { days: { create: nestedDays(days) } },
        include: planInclude,
      });
    });
    res.json(plan);
  }),
);
apiRouter.delete(
  "/itineraries/:id",
  route(async (req, res) => {
    const version = z.coerce.number().int().positive().parse(req.query.version);
    const result = await db.itinerary.deleteMany({
      where: {
        id: uuid(req.params.id),
        authorId: requireUser(req).id,
        version,
      },
    });
    if (!result.count)
      throw new HttpError(
        409,
        "Lịch trình đã thay đổi hoặc không thuộc tài khoản này.",
      );
    res.status(204).end();
  }),
);
apiRouter.get(
  "/places/ratings",
  route(async (_req, res) => {
    const groups = await db.review.groupBy({
      by: ["placeId"],
      _avg: { rating: true },
      _count: { rating: true },
    });
    res.json(
      Object.fromEntries(
        groups.map((g) => [
          g.placeId,
          { average: g._avg.rating, count: g._count.rating },
        ]),
      ),
    );
  }),
);
apiRouter.get(
  "/places/:id/reviews",
  route(async (req, res) => {
    res.json(
      page(
        await db.review.findMany({
          where: { placeId: placeId(req.params.id), ...cursorQuery(req.query) },
          include: { user: { select: memberSelect } },
          orderBy: [...newest],
          take: 21,
        }),
      ),
    );
  }),
);
apiRouter.put(
  "/places/:id/review",
  route(async (req, res) => {
    const input = reviewSchema.parse(req.body),
      id = placeId(req.params.id),
      userId = requireUser(req).id;
    const result = await transaction(async (tx) => {
      const review = await tx.review.upsert({
        where: { userId_placeId: { userId, placeId: id } },
        create: { ...input, userId, placeId: id },
        update: input,
      });
      const awarded = await awardPoints(tx, userId, "REVIEW", String(id));
      return { review, awarded };
    });
    res.json(result);
  }),
);
apiRouter.get(
  "/checkins",
  route(async (req, res) => {
    const userId = requireUser(req).id;
    const visits = await db.checkIn.findMany({
      where: { userId },
      distinct: ["placeId"],
      select: { placeId: true, place: { select: { provinceId: true } } },
    });
    res.json({
      places: visits.map((v) => v.placeId),
      provinces: [
        ...new Set(visits.map((v) => currentProvinceId(v.place.provinceId))),
      ],
    });
  }),
);
apiRouter.post(
  "/places/:id/checkin",
  route(async (req, res) => {
    const position = checkInSchema.parse(req.body),
      id = placeId(req.params.id),
      userId = requireUser(req).id;
    if (Math.abs(Date.now() - position.timestamp) > 120_000)
      throw new HttpError(422, "Vị trí đã cũ. Hãy lấy lại vị trí hiện tại.");
    const result = await transaction(async (tx) => {
      const place = await tx.place.findUnique({ where: { id } });
      if (!place) throw new HttpError(404, "Không tìm thấy điểm đến.");
      if (
        distanceMeters(
          place.lat,
          place.lng,
          position.latitude,
          position.longitude,
        ) > 1000
      )
        throw new HttpError(
          422,
          "Bạn cần ở trong phạm vi 1 km của điểm đến để check-in.",
        );
      const day = vietnamDay();
      await tx.checkIn.createMany({
        data: [{ userId, placeId: id, day }],
        skipDuplicates: true,
      });
      return {
        awarded: await awardPoints(tx, userId, "CHECKIN", `${id}:${day}`),
      };
    });
    res.json(result);
  }),
);
