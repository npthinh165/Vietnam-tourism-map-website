import { z } from "zod";
import { currentProvinceName } from "./provinces";

export const TIERS = [
  { key: "BRONZE", name: "Đồng", min: 0 },
  { key: "SILVER", name: "Bạc", min: 200 },
  { key: "GOLD", name: "Vàng", min: 500 },
  { key: "DIAMOND", name: "Kim Cương", min: 1000 },
] as const;
export const REWARDS = {
  SIGNUP: 50,
  REVIEW: 20,
  ITINERARY: 30,
  CHECKIN: 10,
} as const;
export const DAILY_CAPS = {
  SIGNUP: 1,
  REVIEW: 5,
  ITINERARY: 3,
  CHECKIN: 5,
} as const;
export const tierFor = (points: number) =>
  [...TIERS].reverse().find((t) => points >= t.min) || TIERS[0];
export const vietnamDay = (date = new Date()) =>
  new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const trimmed = (min: number, max: number) =>
  z.string().trim().min(min).max(max);
export const passwordSchema = z
  .string()
  .min(12, "Mật khẩu cần ít nhất 12 ký tự.")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Mật khẩu vượt quá 72 byte UTF-8.",
  );
const credentials = {
  email: z.string().trim().toLowerCase().email("Email không hợp lệ.").max(254),
  password: passwordSchema,
};
export const signupSchema = z
  .object({
    ...credentials,
    name: z
      .string()
      .trim()
      .min(2, "Họ và tên cần ít nhất 2 ký tự.")
      .max(80, "Họ và tên tối đa 80 ký tự."),
  })
  .strict();
export const loginSchema = z
  .object({
    ...credentials,
    password: z
      .string()
      .min(1)
      .refine(
        (v) => new TextEncoder().encode(v).length <= 72,
        "Mật khẩu vượt quá 72 byte UTF-8.",
      ),
  })
  .strict();
export const postSchema = z
  .object({
    content: trimmed(1, 5000),
    province: trimmed(0, 100).transform(currentProvinceName),
    imageUrl: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .max(2048)
          .refine((v) => {
            const u = new URL(v);
            return u.protocol === "https:" && !u.username && !u.password;
          }, "Ảnh cần liên kết HTTPS."),
      ])
      .default(""),
  })
  .strict();
export const commentSchema = z.object({ content: trimmed(1, 2000) }).strict();
export const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    content: trimmed(20, 3000),
  })
  .strict();
export const checkInSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z
      .number()
      .min(0)
      .max(200, "Cần vị trí chính xác trong phạm vi 200 m."),
    timestamp: z.number().int().positive(),
  })
  .strict();
const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ cần có dạng HH:mm.");
const activityDraftSchema = z
  .object({
    time: z.string().max(5),
    endTime: z.string().max(5),
    title: trimmed(0, 160),
    place: trimmed(0, 160),
    notes: trimmed(0, 2000),
    cost: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();
export const activitySchema = activityDraftSchema
  .extend({ time: clock, endTime: clock, title: trimmed(2, 160) })
  .refine((a) => a.endTime > a.time, "Giờ kết thúc phải sau giờ bắt đầu.");
const daySchema = z
  .object({
    title: trimmed(1, 120),
    activities: z.array(activitySchema).min(1).max(20),
  })
  .strict()
  .superRefine((day, ctx) => {
    const sorted = [...day.activities].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
    if (sorted.some((a, i) => i > 0 && a.time < sorted[i - 1].endTime))
      ctx.addIssue({
        code: "custom",
        message: "Các hoạt động trong ngày không được trùng giờ.",
      });
  });
export const itineraryDraftSchema = z
  .object({
    title: trimmed(0, 140),
    description: trimmed(0, 5000),
    province: trimmed(0, 100).transform(currentProvinceName),
    visibility: z.enum(["PRIVATE", "PUBLIC"]),
    days: z
      .array(
        z
          .object({
            title: trimmed(0, 120),
            activities: z.array(activityDraftSchema).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const itinerarySchema = itineraryDraftSchema.extend({
  title: trimmed(3, 140),
  province: trimmed(1, 100).transform(currentProvinceName),
  days: z.array(daySchema).min(1).max(30),
});
export const savedDraftSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive().optional(),
    input: itineraryDraftSchema,
  })
  .strict();
export type ItineraryInput = z.infer<typeof itinerarySchema>;
export type PostInput = z.infer<typeof postSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
export interface Member {
  id: string;
  name: string;
  points: number;
  tier: (typeof TIERS)[number]["key"];
}
export interface SessionUser extends Member {
  email: string;
  role: "USER" | "ADMIN";
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface FeedPost extends PostInput {
  id: string;
  author: Member;
  createdAt: string;
  updatedAt: string;
  liked: boolean;
  likeCount: number;
  commentCount: number;
}
export interface FeedComment {
  id: string;
  author: Member;
  content: string;
  createdAt: string;
}
export interface TravelPlan extends ItineraryInput {
  id: string;
  authorId: string;
  author: Member;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface PlaceReview {
  id: string;
  user: Member;
  rating: number;
  content: string;
  createdAt: string;
}
export interface PointRecord {
  id: string;
  event: keyof typeof REWARDS;
  source: string;
  amount: number;
  createdAt: string;
}
export function distanceMeters(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
