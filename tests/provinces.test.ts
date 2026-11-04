import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { area, booleanPointInPolygon, point } from "@turf/turf";
import { PGlite } from "@electric-sql/pglite";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import {
  PROVINCES_34,
  currentProvinceId,
  currentProvinceName,
  normalizeProvinceName,
} from "../shared/provinces.ts";
import { PROVINCE_SEED, LOCATION_SEED } from "../src/data/seedData63.ts";
import { buildProvinces34, LOCATIONS_34 } from "../src/data/provinces34.ts";
import { buildProvinceGeoJSON } from "../tools/build-geojson.js";
import { itinerarySchema, postSchema } from "../shared/travel.ts";

const read = (name: string) => readFile(new URL(name, import.meta.url), "utf8");
test("all 63 former provinces map once into 34 stable province IDs", () => {
  assert.equal(PROVINCES_34.length, 34);
  assert.equal(new Set(PROVINCES_34.map((p) => p.id)).size, 34);
  const previous = PROVINCES_34.flatMap((p) => p.previous);
  assert.equal(previous.length, 63);
  assert.deepEqual(
    previous.map((p) => p.id).sort((a, b) => a - b),
    PROVINCE_SEED.map((p) => p.id),
  );
  for (const old of PROVINCE_SEED) {
    assert.equal(previous.find((p) => p.id === old.id)?.name, old.name);
    assert.equal(
      currentProvinceId(currentProvinceId(old.id)),
      currentProvinceId(old.id),
    );
  }
  assert.equal(currentProvinceId(33), 32); // Quảng Nam -> Đà Nẵng
  assert.equal(currentProvinceId(58), 57); // Kiên Giang -> An Giang
  assert.equal(currentProvinceId(49), 50); // Bà Rịa - Vũng Tàu -> HCM
  assert.equal(currentProvinceName("Thừa Thiên Huế"), "Huế");
  assert.equal(currentProvinceName("ha giang"), "Tuyên Quang");
  assert.equal(currentProvinceName("TP Hồ Chí Minh"), "TP. Hồ Chí Minh");
  assert.equal(currentProvinceName("Hà Nội - Đà Nẵng"), "Hà Nội - Đà Nẵng");
});

test("destinations keep IDs and coordinates while aliases and content cover merged provinces", () => {
  assert.equal(LOCATIONS_34.length, LOCATION_SEED.length);
  assert.equal(
    new Set(LOCATIONS_34.map((p) => p.location_id)).size,
    LOCATION_SEED.length,
  );
  const provinces = buildProvinces34();
  for (const [i, place] of LOCATIONS_34.entries()) {
    assert.equal(place.location_id, LOCATION_SEED[i].location_id);
    assert.equal(place.lat, LOCATION_SEED[i].lat);
    assert.equal(place.lng, LOCATION_SEED[i].lng);
    assert.ok(provinces.some((p) => p.province_id === place.province_id));
  }
  assert.equal(new Set(LOCATIONS_34.map((p) => p.province_id)).size, 34);
  const daNang = provinces.find((p) => p.name === "Đà Nẵng")!;
  assert.deepEqual(daNang.previous_names, ["Đà Nẵng", "Quảng Nam"]);
  assert.match(daNang.top_landmark, /Hội An/);
  assert.equal(
    postSchema.parse({ content: "Thăm Hội An", province: "Quảng Nam" })
      .province,
    "Đà Nẵng",
  );
  const trip = itinerarySchema.parse({
    title: "Khám phá Phú Quốc",
    description: "",
    province: "Kiên Giang",
    visibility: "PRIVATE",
    days: [
      {
        title: "Ngày 1",
        activities: [
          {
            time: "08:00",
            endTime: "09:00",
            title: "Tham quan",
            place: "",
            notes: "",
            cost: 0,
          },
        ],
      },
    ],
  });
  assert.equal(trip.province, "An Giang");
});

test("published geometry merges all source polygons, keeps islands and matches the catalog", async () => {
  const raw = JSON.parse(await read("../data/raw-provinces.geojson"));
  const built = buildProvinceGeoJSON(raw);
  const published = JSON.parse(
    await read("../public/data/vietnam-provinces.geojson"),
  );
  assert.deepEqual(published, built);
  assert.deepEqual(
    JSON.parse(await read("../data/vietnam-provinces.geojson")),
    built,
  );
  assert.equal(published.features.length, 34);
  for (const p of PROVINCES_34) {
    const feature: Feature<Polygon | MultiPolygon> | undefined =
      published.features.find((f: any) => f.id === p.id);
    assert.ok(feature);
    assert.equal(feature.properties?.name, p.name);
    const names = p.previous.map((old) => normalizeProvinceName(old.name));
    if (p.id === 50) names.push(normalizeProvinceName("Côn Đảo"));
    const expectedArea = raw.features
      .filter((f: any) =>
        names.includes(normalizeProvinceName(f.properties.shapeName)),
      )
      .reduce((total: number, f: any) => total + area(f), 0);
    assert.ok(
      Math.abs(area(feature) - expectedArea) / expectedArea < 0.005,
      `Lost geometry for ${p.name}`,
    );
  }
  for (const [id, lng, lat] of [
    [50, 106.6182, 8.69386],
    [57, 104, 10.3],
    [32, 108.328, 15.88],
    [4, 105.3197, 23.36],
    [5, 104.0867, 21.8542],
  ]) {
    const feature = published.features.find((f) => f.id === id);
    assert.ok(feature);
    assert.ok(
      booleanPointInPolygon(point([lng, lat]), feature),
      `Missing destination/island at ${lng},${lat}`,
    );
  }
  assert.throws(
    () => buildProvinceGeoJSON({ ...raw, features: raw.features.slice(1) }),
    /thiếu hoặc trùng/,
  );
});

test("data migration remaps existing places without losing reviews or check-ins", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      await read("../prisma/migrations/202610170001_initial/migration.sql"),
    );
    await db.exec(
      `INSERT INTO "User" (id, email, name, "passwordHash") VALUES ('00000000-0000-4000-8000-000000000001', 'migration@example.com', 'Migration test', 'test-only');`,
    );
    for (const old of PROVINCE_SEED) {
      await db.query(
        'INSERT INTO "Place" (id, "provinceId", name, lat, lng) VALUES ($1, $2, $3, $4, $5)',
        [old.id, old.id, old.name, old.lat, old.lng],
      );
    }
    await db.exec(`INSERT INTO "Review" (id, "userId", "placeId", rating, content, "updatedAt") VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 33, 5, 'Đánh giá có trước khi sáp nhập', NOW());
      INSERT INTO "CheckIn" (id, "userId", "placeId", day) VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 33, '2025-06-01');`);
    const sql = await read(
      "../prisma/migrations/202610170003_provinces_34/migration.sql",
    );
    await db.exec(sql);
    await db.exec(sql); // Running twice must never remap a new province again.
    const places = await db.query<{ id: number; provinceId: number }>(
      'SELECT id, "provinceId" FROM "Place" ORDER BY id',
    );
    for (const row of places.rows)
      assert.equal(row.provinceId, currentProvinceId(row.id));
    assert.equal((await db.query('SELECT * FROM "Review"')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM "CheckIn"')).rows.length, 1);
    await db.exec(
      await read(
        "../prisma/migrations/202610200001_place_content/migration.sql",
      ),
    );
    assert.equal((await db.query('SELECT * FROM "Review"')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM "CheckIn"')).rows.length, 1);
    const created = await db.query<{ id: number; version: number }>(
      `INSERT INTO "Place" ("provinceId", name, lat, lng, description, article)
       VALUES (16, 'Địa điểm mới', 21, 105, 'Giới thiệu địa điểm', 'Bài mô tả')
       RETURNING id, version`,
    );
    assert.ok(created.rows[0].id > 100000);
    assert.equal(created.rows[0].version, 1);
  } finally {
    await db.close();
  }
});
