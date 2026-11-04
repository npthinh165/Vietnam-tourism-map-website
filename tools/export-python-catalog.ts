// The browser and Python server share the exact destination IDs and content.
import { writeFileSync, readFileSync } from "node:fs";
import { LOCATIONS_34 } from "../src/data/provinces34.ts";
import { PROVINCES_34 } from "../shared/provinces.ts";

const file = new URL("../backend/catalog.json", import.meta.url);
const content = JSON.stringify({ provinces: PROVINCES_34, places: LOCATIONS_34 }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(file, "utf8") !== content)
    throw new Error("Danh mục Python chưa đồng bộ. Chạy npm run catalog:export.");
} else {
  writeFileSync(file, content, "utf8");
  console.log(`Exported ${PROVINCES_34.length} provinces and ${LOCATIONS_34.length} places.`);
}
