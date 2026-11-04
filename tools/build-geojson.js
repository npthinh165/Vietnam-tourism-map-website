// Merge the original geometry before simplification to remove former internal borders.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { featureCollection, union, simplify } from "@turf/turf";
import {
  PROVINCES_34,
  PROVINCE_SOURCE,
  PROVINCE_VERSION,
  normalizeProvinceName,
} from "../shared/provinces.ts";

/** @returns {import("geojson").FeatureCollection<import("geojson").Polygon | import("geojson").MultiPolygon>} */
export function buildProvinceGeoJSON(raw) {
  if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features))
    throw new Error("Dữ liệu ranh giới gốc không hợp lệ.");
  const used = new Set();
  const features = PROVINCES_34.map((p) => {
    const names = p.previous.map((old) => normalizeProvinceName(old.name));
    // The original source stores Côn Đảo as a separate ADM1 feature.
    if (p.id === 50) names.push(normalizeProvinceName("Côn Đảo"));
    const parts = names.map((name) => {
      const matches = raw.features.filter(
        (f) =>
          normalizeProvinceName(
            f.properties?.shapeName || f.properties?.name || "",
          ) === name,
      );
      if (matches.length !== 1)
        throw new Error(`Ranh giới thiếu hoặc trùng: ${name}`);
      const feature = matches[0];
      if (
        !["Polygon", "MultiPolygon"].includes(feature.geometry?.type) ||
        used.has(feature)
      )
        throw new Error(`Ranh giới không hợp lệ: ${name}`);
      used.add(feature);
      return feature;
    });
    const merged =
      parts.length === 1 ? parts[0] : union(featureCollection(parts));
    if (!merged) throw new Error(`Không gộp được ranh giới ${p.name}.`);
    return {
      type: "Feature",
      id: p.id,
      properties: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        region: p.region,
        previousNames: p.previous.map((old) => old.name),
      },
      geometry: simplify(merged, {
        tolerance: 0.001,
        highQuality: true,
        mutate: false,
      }).geometry,
    };
  });
  if (used.size !== raw.features.length)
    throw new Error("Có ranh giới gốc chưa được gộp vào 34 tỉnh/thành.");
  return {
    type: "FeatureCollection",
    version: PROVINCE_VERSION,
    source: PROVINCE_SOURCE,
    features,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const raw = JSON.parse(
    await fs.readFile(path.join(root, "data/raw-provinces.geojson"), "utf8"),
  );
  const data = JSON.stringify(buildProvinceGeoJSON(raw));
  // Generate and validate completely before replacing either published file.
  for (const directory of ["data", "public/data"])
    await fs.writeFile(
      path.join(root, directory, "vietnam-provinces.geojson"),
      data,
      "utf8",
    );
  console.log(
    `Đã gộp đủ 34 tỉnh/thành sau sáp nhập: ${(Buffer.byteLength(data) / 1024).toFixed(1)} KB.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
