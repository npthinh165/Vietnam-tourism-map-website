import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceMeters,
  itinerarySchema,
  savedDraftSchema,
  passwordSchema,
  postSchema,
  signupSchema,
  tierFor,
  vietnamDay,
} from "../shared/travel.ts";

test("incomplete drafts restore safely but cannot bypass API validation", () => {
  const input = {
    title: "",
    description: "",
    province: "",
    visibility: "PRIVATE",
    days: [
      {
        title: "",
        activities: [
          { time: "", endTime: "", title: "", place: "", notes: "", cost: 0 },
        ],
      },
    ],
  };
  assert.equal(
    savedDraftSchema.safeParse({
      id: "12345678-1234-4234-8234-123456789abc",
      input,
    }).success,
    true,
  );
  assert.equal(itinerarySchema.safeParse(input).success, false);
  assert.equal(
    savedDraftSchema.safeParse({ id: "bad-id", input }).success,
    false,
  );
});

test("membership thresholds and Vietnam midnight boundaries", () => {
  assert.deepEqual(
    [0, 199, 200, 499, 500, 999, 1000].map((p) => tierFor(p).name),
    ["Đồng", "Đồng", "Bạc", "Bạc", "Vàng", "Vàng", "Kim Cương"],
  );
  assert.equal(vietnamDay(new Date("2026-10-17T16:59:59Z")), "2026-10-17");
  assert.equal(vietnamDay(new Date("2026-10-17T17:00:00Z")), "2026-10-18");
});
test("registration normalizes email and rejects bcrypt truncation or injected roles", () => {
  assert.equal(
    signupSchema.parse({
      name: "Du khách",
      email: " USER@EXAMPLE.COM ",
      password: "a long password",
    }).email,
    "user@example.com",
  );
  assert.equal(passwordSchema.safeParse("😀".repeat(19)).success, false);
  assert.equal(
    signupSchema.safeParse({
      name: "Du khách",
      email: "u@example.com",
      password: "a long password",
      role: "admin",
    }).success,
    false,
  );
});
test("itinerary validation rejects overlaps, impossible times and invalid budgets", () => {
  const activity = {
    time: "08:00",
    endTime: "09:00",
    title: "Tham quan",
    place: "",
    notes: "",
    cost: 10000,
  };
  const input = {
    title: "Hành trình Hà Nội",
    description: "",
    province: "Hà Nội",
    visibility: "PRIVATE",
    days: [{ title: "Ngày đầu", activities: [activity] }],
  };
  assert.equal(itinerarySchema.safeParse(input).success, true);
  assert.equal(
    itinerarySchema.safeParse({
      ...input,
      days: [
        {
          title: "Trùng giờ",
          activities: [activity, { ...activity, time: "08:30" }],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    itinerarySchema.safeParse({
      ...input,
      days: [
        { title: "Giờ sai", activities: [{ ...activity, endTime: "24:00" }] },
      ],
    }).success,
    false,
  );
  assert.equal(
    itinerarySchema.safeParse({
      ...input,
      days: [{ title: "Giá sai", activities: [{ ...activity, cost: -1 }] }],
    }).success,
    false,
  );
});
test("image schemes and check-in distances", () => {
  assert.equal(
    postSchema.safeParse({
      content: "Xin chào",
      province: "",
      imageUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    postSchema.safeParse({
      content: "Xin chào",
      province: "",
      imageUrl: "https://user:pass@example.com/photo",
    }).success,
    false,
  );
  assert.equal(distanceMeters(21, 105, 21, 105), 0);
  assert.ok(distanceMeters(21, 105, 22, 106) > 100000);
});
