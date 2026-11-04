import type { Place } from "@prisma/client";
import { LOCATIONS_34 } from "../src/data/provinces34.ts";
import type { ManagedPlace } from "../shared/places.ts";

const originals = new Map(
  LOCATIONS_34.map((place) => [place.location_id, place]),
);
export function managedPlace(place: Place): ManagedPlace {
  const original = originals.get(place.id);
  const legacy = !place.description && original;
  return {
    id: place.id,
    version: place.version,
    provinceId: place.provinceId,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    category: (legacy
      ? original.category
      : place.category) as ManagedPlace["category"],
    season: (legacy ? original.season : place.season) as ManagedPlace["season"],
    address: legacy ? original.address : place.address,
    description: legacy ? original.description : place.description,
    article:
      place.article || (place.version === 1 ? original?.article || "" : ""),
    imageUrl: place.imageUrl,
  };
}
