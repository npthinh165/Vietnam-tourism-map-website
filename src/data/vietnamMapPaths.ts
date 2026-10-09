// Accurate SVG paths and regional geometry for Vietnam Map

export interface RegionPolygon {
  id: string;
  name: string;
  province_id: number;
  regionCode: 'Bac' | 'Trung' | 'Nam' | 'TayNguyen';
  path: string;
  center_x: number;
  center_y: number;
  label: string;
}

export interface IslandMarker {
  name: string;
  subname: string;
  x: number;
  y: number;
  territory: string;
}

export const VIETNAM_ISLANDS: IslandMarker[] = [
  {
    name: 'Quần đảo Hoàng Sa',
    subname: 'Huyện Hoàng Sa - TP. Đà Nẵng',
    x: 410,
    y: 440,
    territory: 'Việt Nam'
  },
  {
    name: 'Quần đảo Trường Sa',
    subname: 'Huyện đảo Trường Sa - Khánh Hòa',
    x: 420,
    y: 780,
    territory: 'Việt Nam'
  },
  {
    name: 'Đảo Phú Quốc',
    subname: 'TP. Phú Quốc - Kiên Giang',
    x: 135,
    y: 840,
    territory: 'Việt Nam'
  },
  {
    name: 'Côn Đảo',
    subname: 'Bà Rịa - Vũng Tàu',
    x: 270,
    y: 860,
    territory: 'Việt Nam'
  }
];

// SVG Regions of Vietnam plotted on 500 x 950 canvas
export const REGION_POLYGONS: RegionPolygon[] = [
  // 1. Vùng Tây Bắc Bộ (Lào Cai, Lai Châu, Điện Biên, Sơn La)
  {
    id: 'tay-bac',
    name: 'Lào Cai & Tây Bắc',
    province_id: 8,
    regionCode: 'Bac',
    path: 'M 130 50 L 175 40 L 195 85 L 180 130 L 135 155 L 90 145 L 85 95 Z',
    center_x: 145,
    center_y: 95,
    label: 'Tây Bắc'
  },
  // 2. Vùng Đông Bắc & Hà Giang
  {
    id: 'ha-giang-dong-bac',
    name: 'Hà Giang & Đông Bắc',
    province_id: 11,
    regionCode: 'Bac',
    path: 'M 175 40 L 235 30 L 270 70 L 255 110 L 195 85 Z',
    center_x: 220,
    center_y: 65,
    label: 'Hà Giang'
  },
  // 3. Hà Nội & Đồng bằng Bắc Bộ
  {
    id: 'ha-noi-dbs-hong',
    name: 'Hà Nội (Thủ đô)',
    province_id: 2,
    regionCode: 'Bac',
    path: 'M 195 85 L 255 110 L 245 155 L 205 160 L 180 130 Z',
    center_x: 220,
    center_y: 130,
    label: 'Hà Nội'
  },
  // 4. Quảng Ninh & Vịnh Hạ Long
  {
    id: 'quang-ninh',
    name: 'Quảng Ninh',
    province_id: 5,
    regionCode: 'Bac',
    path: 'M 255 110 L 320 95 L 305 145 L 255 145 Z',
    center_x: 285,
    center_y: 120,
    label: 'Quảng Ninh'
  },
  // 5. Hải Phòng
  {
    id: 'hai-phong',
    name: 'Hải Phòng',
    province_id: 15,
    regionCode: 'Bac',
    path: 'M 245 155 L 275 145 L 270 175 L 240 170 Z',
    center_x: 258,
    center_y: 160,
    label: 'Hải Phòng'
  },
  // 6. Ninh Bình & Nam Đồng Bằng
  {
    id: 'ninh-binh',
    name: 'Ninh Bình',
    province_id: 9,
    regionCode: 'Bac',
    path: 'M 205 160 L 240 170 L 235 215 L 190 200 Z',
    center_x: 220,
    center_y: 190,
    label: 'Ninh Bình'
  },
  // 7. Bắc Trung Bộ (Thanh Hóa - Nghệ An - Hà Tĩnh)
  {
    id: 'bac-trung-bo-bac',
    name: 'Thanh Hóa - Nghệ An',
    province_id: 9,
    regionCode: 'Trung',
    path: 'M 190 200 L 235 215 L 245 280 L 175 270 Z',
    center_x: 215,
    center_y: 245,
    label: 'Bắc Trung Bộ'
  },
  // 8. Quảng Bình (Vương quốc hang động)
  {
    id: 'quang-binh',
    name: 'Quảng Bình',
    province_id: 12,
    regionCode: 'Trung',
    path: 'M 215 280 L 265 310 L 250 365 L 205 340 Z',
    center_x: 240,
    center_y: 330,
    label: 'Quảng Bình'
  },
  // 9. Thừa Thiên Huế (Cố đô)
  {
    id: 'thua-thien-hue',
    name: 'Thừa Thiên Huế',
    province_id: 4,
    regionCode: 'Trung',
    path: 'M 250 365 L 290 385 L 280 430 L 240 405 Z',
    center_x: 268,
    center_y: 400,
    label: 'Thừa Thiên Huế'
  },
  // 10. Đà Nẵng & Quảng Nam
  {
    id: 'da-nang',
    name: 'Đà Nẵng',
    province_id: 1,
    regionCode: 'Trung',
    path: 'M 280 430 L 315 425 L 325 480 L 275 485 Z',
    center_x: 298,
    center_y: 450,
    label: 'Đà Nẵng'
  },
  // 11. Bình Định & Duyên Hải Nam Trung Bộ
  {
    id: 'binh-dinh',
    name: 'Bình Định & Quy Nhơn',
    province_id: 14,
    regionCode: 'Trung',
    path: 'M 325 480 L 345 550 L 330 615 L 285 580 Z',
    center_x: 320,
    center_y: 550,
    label: 'Bình Định'
  },
  // 12. Tây Nguyên (Gia Lai - Đắk Lắk)
  {
    id: 'tay-nguyen-bac',
    name: 'Tây Nguyên (Đắk Lắk)',
    province_id: 6,
    regionCode: 'TayNguyen',
    path: 'M 275 485 L 320 540 L 285 640 L 235 590 Z',
    center_x: 275,
    center_y: 565,
    label: 'Tây Nguyên'
  },
  // 13. Lâm Đồng & Đà Lạt
  {
    id: 'lam-dong',
    name: 'Lâm Đồng (Đà Lạt)',
    province_id: 6,
    regionCode: 'TayNguyen',
    path: 'M 285 640 L 330 650 L 320 730 L 265 720 Z',
    center_x: 298,
    center_y: 685,
    label: 'Lâm Đồng'
  },
  // 14. Khánh Hòa & Nha Trang
  {
    id: 'khanh-hoa',
    name: 'Khánh Hòa (Nha Trang)',
    province_id: 7,
    regionCode: 'Trung',
    path: 'M 330 615 L 360 660 L 350 720 L 320 680 Z',
    center_x: 342,
    center_y: 670,
    label: 'Khánh Hòa'
  },
  // 15. TP. Hồ Chí Minh & Đông Nam Bộ
  {
    id: 'tp-ho-chi-minh',
    name: 'TP. Hồ Chí Minh',
    province_id: 3,
    regionCode: 'Nam',
    path: 'M 235 720 L 280 720 L 275 790 L 215 780 Z',
    center_x: 250,
    center_y: 755,
    label: 'TP. Hồ Chí Minh'
  },
  // 16. Cần Thơ & Miền Tây Sông Nước
  {
    id: 'can-tho',
    name: 'Cần Thơ',
    province_id: 13,
    regionCode: 'Nam',
    path: 'M 215 780 L 265 790 L 245 845 L 185 830 Z',
    center_x: 225,
    center_y: 815,
    label: 'Cần Thơ'
  },
  // 17. Kiên Giang & Phú Quốc
  {
    id: 'kien-giang',
    name: 'Kiên Giang & Đảo Ngọc',
    province_id: 10,
    regionCode: 'Nam',
    path: 'M 170 800 L 210 825 L 195 870 L 140 855 Z',
    center_x: 175,
    center_y: 840,
    label: 'Kiên Giang'
  },
  // 18. Cà Mau (Mũi Cực Nam)
  {
    id: 'ca-mau',
    name: 'Cà Mau',
    province_id: 10,
    regionCode: 'Nam',
    path: 'M 185 850 L 225 855 L 205 915 L 155 895 Z',
    center_x: 185,
    center_y: 885,
    label: 'Cà Mau'
  }
];
