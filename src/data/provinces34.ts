import type { Province, LocationItem } from "../types";
import { buildCompleteProvincesData, LOCATION_SEED } from "./seedData63";
import { PROVINCES_34, provinceForPreviousId } from "../../shared/provinces";
import { PLACE_INTRODUCTIONS } from "../../shared/place-introductions";

const legacy = new Map(
  buildCompleteProvincesData().map((p) => [p.province_id, p]),
);
export function buildProvinces34(): Province[] {
  return PROVINCES_34.map((definition) => {
    const parts = definition.previous.map((p) => legacy.get(p.id)!);
    const primary = legacy.get(definition.id)!;
    const summary = (field: "history_brief" | "geography_brief") =>
      parts.length === 1
        ? primary[field]
        : parts.map((p) => `${p.name}: ${p[field]}`).join(" ");
    return {
      ...primary,
      province_id: definition.id,
      name: definition.name,
      slug: definition.slug,
      region: definition.region,
      previous_names: definition.previous.map((p) => p.name),
      description:
        parts.length > 1
          ? `${definition.name} sau sáp nhập: kết nối các điểm đến thuộc ${parts.map((p) => p.name).join(", ")}.`
          : `${definition.name} — ${primary.geography_brief}`,
      history_brief: summary("history_brief"),
      geography_brief: summary("geography_brief"),
      specialty_dish: parts.map((p) => p.specialty_dish).join(", "),
      top_festival: parts.map((p) => p.top_festival).join("; "),
      top_landmark: parts.map((p) => p.top_landmark).join(", "),
      // Aggregate the existing historical sample metrics, not 2025 statistics.
      gdp: parts.reduce((sum, p) => sum + p.gdp, 0),
      population: parts.reduce((sum, p) => sum + p.population, 0),
      tourist_density: parts.reduce((sum, p) => sum + p.tourist_density, 0),
      tourists_million: parts.reduce(
        (sum, p) => sum + (p.tourists_million || 0),
        0,
      ),
      avg_rating: 0,
      review_count: 0,
    };
  });
}

// Keep destination IDs and coordinates stable so reviews and check-ins survive.
export const LOCATIONS_34: LocationItem[] = LOCATION_SEED.map((place) => {
  const province = provinceForPreviousId(place.province_id);
  if (!province)
    throw new Error(`Chưa ánh xạ tỉnh của địa điểm ${place.location_id}.`);
  return {
    ...place,
    province_id: province.id,
    article: PLACE_INTRODUCTIONS[place.location_id],
  };
});
