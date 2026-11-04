// Administrative grouping effective 01/07/2025, Resolution 202/2025/QH15.
// IDs are stable application IDs, not official administrative codes.
export const PROVINCE_SOURCE =
  "https://baochinhphu.vn/quoc-hoi-thong-qua-viec-sap-xep-don-vi-hanh-chinh-cap-tinh-ca-nuoc-co-34-tinh-thanh-102250612100156988.htm";
export const PROVINCE_VERSION = "2025-07-01";

interface ProvinceDefinition {
  id: number;
  name: string;
  slug: string;
  region: "Bắc" | "Trung" | "Nam";
  previous: { id: number; name: string }[];
}
const province = (
  id: number,
  name: string,
  slug: string,
  region: ProvinceDefinition["region"],
  previous: [number, string][],
): ProvinceDefinition => ({
  id,
  name,
  slug,
  region,
  previous: previous.map(([id, name]) => ({ id, name })),
});

export const PROVINCES_34: ProvinceDefinition[] = [
  province(2, "Cao Bằng", "cao-bang", "Bắc", [[2, "Cao Bằng"]]),
  province(4, "Tuyên Quang", "tuyen-quang", "Bắc", [
    [1, "Hà Giang"],
    [4, "Tuyên Quang"],
  ]),
  province(5, "Lào Cai", "lao-cai", "Bắc", [
    [5, "Lào Cai"],
    [6, "Yên Bái"],
  ]),
  province(7, "Thái Nguyên", "thai-nguyen", "Bắc", [
    [3, "Bắc Kạn"],
    [7, "Thái Nguyên"],
  ]),
  province(8, "Lạng Sơn", "lang-son", "Bắc", [[8, "Lạng Sơn"]]),
  province(10, "Phú Thọ", "phu-tho", "Bắc", [
    [10, "Phú Thọ"],
    [15, "Hòa Bình"],
    [18, "Vĩnh Phúc"],
  ]),
  province(11, "Quảng Ninh", "quang-ninh", "Bắc", [[11, "Quảng Ninh"]]),
  province(12, "Điện Biên", "dien-bien", "Bắc", [[12, "Điện Biên"]]),
  province(13, "Lai Châu", "lai-chau", "Bắc", [[13, "Lai Châu"]]),
  province(14, "Sơn La", "son-la", "Bắc", [[14, "Sơn La"]]),
  province(16, "Hà Nội", "ha-noi", "Bắc", [[16, "Hà Nội"]]),
  province(17, "Hải Phòng", "hai-phong", "Bắc", [
    [17, "Hải Phòng"],
    [20, "Hải Dương"],
  ]),
  province(19, "Bắc Ninh", "bac-ninh", "Bắc", [
    [9, "Bắc Giang"],
    [19, "Bắc Ninh"],
  ]),
  province(21, "Hưng Yên", "hung-yen", "Bắc", [
    [21, "Hưng Yên"],
    [22, "Thái Bình"],
  ]),
  province(25, "Ninh Bình", "ninh-binh", "Bắc", [
    [23, "Hà Nam"],
    [24, "Nam Định"],
    [25, "Ninh Bình"],
  ]),
  province(26, "Thanh Hóa", "thanh-hoa", "Trung", [[26, "Thanh Hóa"]]),
  province(27, "Nghệ An", "nghe-an", "Trung", [[27, "Nghệ An"]]),
  province(28, "Hà Tĩnh", "ha-tinh", "Trung", [[28, "Hà Tĩnh"]]),
  province(30, "Quảng Trị", "quang-tri", "Trung", [
    [29, "Quảng Bình"],
    [30, "Quảng Trị"],
  ]),
  province(31, "Huế", "hue", "Trung", [[31, "Thừa Thiên Huế"]]),
  province(32, "Đà Nẵng", "da-nang", "Trung", [
    [32, "Đà Nẵng"],
    [33, "Quảng Nam"],
  ]),
  province(34, "Quảng Ngãi", "quang-ngai", "Trung", [
    [34, "Quảng Ngãi"],
    [40, "Kon Tum"],
  ]),
  province(37, "Khánh Hòa", "khanh-hoa", "Trung", [
    [37, "Khánh Hòa"],
    [38, "Ninh Thuận"],
  ]),
  province(41, "Gia Lai", "gia-lai", "Trung", [
    [35, "Bình Định"],
    [41, "Gia Lai"],
  ]),
  province(42, "Đắk Lắk", "dak-lak", "Trung", [
    [36, "Phú Yên"],
    [42, "Đắk Lắk"],
  ]),
  province(44, "Lâm Đồng", "lam-dong", "Trung", [
    [39, "Bình Thuận"],
    [43, "Đắk Nông"],
    [44, "Lâm Đồng"],
  ]),
  province(46, "Tây Ninh", "tay-ninh", "Nam", [
    [46, "Tây Ninh"],
    [51, "Long An"],
  ]),
  province(48, "Đồng Nai", "dong-nai", "Nam", [
    [45, "Bình Phước"],
    [48, "Đồng Nai"],
  ]),
  province(50, "TP. Hồ Chí Minh", "tp-ho-chi-minh", "Nam", [
    [47, "Bình Dương"],
    [49, "Bà Rịa - Vũng Tàu"],
    [50, "TP. Hồ Chí Minh"],
  ]),
  province(55, "Vĩnh Long", "vinh-long", "Nam", [
    [53, "Bến Tre"],
    [54, "Trà Vinh"],
    [55, "Vĩnh Long"],
  ]),
  province(56, "Đồng Tháp", "dong-thap", "Nam", [
    [52, "Tiền Giang"],
    [56, "Đồng Tháp"],
  ]),
  province(57, "An Giang", "an-giang", "Nam", [
    [57, "An Giang"],
    [58, "Kiên Giang"],
  ]),
  province(59, "Cần Thơ", "can-tho", "Nam", [
    [59, "Cần Thơ"],
    [60, "Hậu Giang"],
    [61, "Sóc Trăng"],
  ]),
  province(63, "Cà Mau", "ca-mau", "Nam", [
    [62, "Bạc Liêu"],
    [63, "Cà Mau"],
  ]),
];

export const normalizeProvinceName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[.–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:tinh|thanh pho|tp)\s+/, "");
const byPreviousId = new Map(
  PROVINCES_34.flatMap((p) => p.previous.map((old) => [old.id, p] as const)),
);
const byName = new Map(
  PROVINCES_34.flatMap((p) =>
    [p.name, ...p.previous.map((old) => old.name)].map(
      (name) => [normalizeProvinceName(name), p] as const,
    ),
  ),
);
export const provinceForPreviousId = (id: number) => byPreviousId.get(id);
export const currentProvinceId = (id: number) => byPreviousId.get(id)?.id ?? id;
// Exact province fields are normalized; free-form routes and authored text stay intact.
export const currentProvinceName = (name: string) =>
  byName.get(normalizeProvinceName(name))?.name ?? name;
