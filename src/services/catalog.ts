import type { FeatureCollection } from "geojson";
import type { ManagedPlace } from "../../shared/places";
import type { LocationItem } from "../types";
import { buildProvinces34, LOCATIONS_34 } from "../data/provinces34";
import { PROVINCES_34, PROVINCE_VERSION } from "../../shared/provinces";
import hero from "../assets/images/vietnam_travel_hero_1791335147966.jpg";
import food from "../assets/images/vietnam_culinary_food_1791335176027.jpg";
import danang from "../assets/images/danang_landmark_1791335159789.jpg";
const image = (value: string) =>
  value.includes("culinary") ? food : value.includes("danang") ? danang : hero;
const places = LOCATIONS_34.map((p) => ({
  ...p,
  image_url: image(p.image_url),
}));
export function locationFromManaged(place: ManagedPlace): LocationItem {
  const original = places.find((p) => p.location_id === place.id);
  return {
    location_id: place.id,
    province_id: place.provinceId,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    season: place.season,
    address: place.address,
    description: place.description,
    article: place.article,
    image_url: place.imageUrl || original?.image_url || hero,
    rating_star: 0,
    review_count: 0,
  };
}
export const catalog = {
  getProvinces: () =>
    buildProvinces34().map((p) => ({
      ...p,
      cover_image: image(p.cover_image),
    })),
  getLocations: (provinceId?: number) =>
    places.filter(
      (p) => provinceId === undefined || p.province_id === provinceId,
    ),
};
export async function fetchVietnamGeoJSON(): Promise<FeatureCollection> {
  const response = await fetch(
    `/data/vietnam-provinces.geojson?v=${PROVINCE_VERSION}`,
  );
  if (!response.ok) throw new Error("Chưa tải được ranh giới địa phương.");
  const data = await response.json();
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw new Error("Dữ liệu bản đồ không hợp lệ.");
  const ids = new Set(
    data.features.map(
      (f: { properties?: { id?: number } }) => f.properties?.id,
    ),
  );
  if (
    data.features.length !== PROVINCES_34.length ||
    ids.size !== PROVINCES_34.length ||
    PROVINCES_34.some((p) => !ids.has(p.id))
  )
    throw new Error("Dữ liệu bản đồ chưa cập nhật đủ 34 tỉnh/thành.");
  return data;
}
