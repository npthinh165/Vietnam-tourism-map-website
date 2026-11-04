import { z } from "zod";
import { PROVINCES_34 } from "./provinces";

export const placeSchema = z
  .object({
    provinceId: z
      .number()
      .int()
      .refine(
        (id) => PROVINCES_34.some((p) => p.id === id),
        "Chọn tỉnh/thành hợp lệ.",
      ),
    name: z.string().trim().min(2).max(160),
    category: z.enum(["Landmark", "History", "Geography", "Food", "Festival"]),
    season: z.enum(["Spring", "Summer", "Autumn", "Winter", "AllYear"]),
    address: z.string().trim().min(3).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    description: z
      .string()
      .trim()
      .min(20, "Giới thiệu cần ít nhất 20 ký tự.")
      .max(3000),
    article: z.string().trim().max(20000),
    imageUrl: z.union([
      z.literal(""),
      z
        .string()
        .url()
        .max(2048)
        .refine((value) => {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        }, "Ảnh cần là liên kết HTTPS."),
    ]),
  })
  .strict();
export const placeUpdateSchema = placeSchema.extend({
  version: z.number().int().positive(),
});
export type PlaceInput = z.infer<typeof placeSchema>;
export type ManagedPlace = PlaceInput & { id: number; version: number };
