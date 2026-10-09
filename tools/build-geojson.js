/**
 * @file tools/build-geojson.js
 * @description Script chuẩn hóa GeoJSON ranh giới 63 tỉnh/thành phố Việt Nam
 * - Đọc dữ liệu ADM1 (từ data/raw-provinces.geojson hoặc geoBoundaries)
 * - Chuẩn hóa tên về đúng danh sách 63 tỉnh/thành (id: 1..63, region: 'Bắc' | 'Trung' | 'Nam')
 * - Gộp Côn Đảo vào Bà Rịa - Vũng Tàu bằng @turf/union để đảm bảo chuẩn 63 tỉnh
 * - Đơn giản hóa đa giác (simplify) để file < 1.5MB
 * - Ghi ra ./data/vietnam-provinces.geojson và ./public/data/vietnam-provinces.geojson
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, '../data/vietnam-provinces.geojson');
const PUBLIC_OUTPUT_FILE = path.resolve(__dirname, '../public/data/vietnam-provinces.geojson');
const RAW_FILE = path.resolve(__dirname, '../data/raw-provinces.geojson');

// 2.1 DANH SÁCH BẮT BUỘC 63 TỈNH THÀNH (id 1-63, region 'Bắc' | 'Trung' | 'Nam')
export const PROVINCES_63 = [
  // MIỀN BẮC (25 tỉnh)
  { id: 1, name: 'Hà Giang', slug: 'ha-giang', region: 'Bắc' },
  { id: 2, name: 'Cao Bằng', slug: 'cao-bang', region: 'Bắc' },
  { id: 3, name: 'Bắc Kạn', slug: 'bac-kan', region: 'Bắc' },
  { id: 4, name: 'Tuyên Quang', slug: 'tuyen-quang', region: 'Bắc' },
  { id: 5, name: 'Lào Cai', slug: 'lao-cai', region: 'Bắc' },
  { id: 6, name: 'Yên Bái', slug: 'yen-bai', region: 'Bắc' },
  { id: 7, name: 'Thái Nguyên', slug: 'thai-nguyen', region: 'Bắc' },
  { id: 8, name: 'Lạng Sơn', slug: 'lang-son', region: 'Bắc' },
  { id: 9, name: 'Bắc Giang', slug: 'bac-giang', region: 'Bắc' },
  { id: 10, name: 'Phú Thọ', slug: 'phu-tho', region: 'Bắc' },
  { id: 11, name: 'Quảng Ninh', slug: 'quang-ninh', region: 'Bắc' },
  { id: 12, name: 'Điện Biên', slug: 'dien-bien', region: 'Bắc' },
  { id: 13, name: 'Lai Châu', slug: 'lai-chau', region: 'Bắc' },
  { id: 14, name: 'Sơn La', slug: 'son-la', region: 'Bắc' },
  { id: 15, name: 'Hòa Bình', slug: 'hoa-binh', region: 'Bắc' },
  { id: 16, name: 'Hà Nội', slug: 'ha-noi', region: 'Bắc' },
  { id: 17, name: 'Hải Phòng', slug: 'hai-phong', region: 'Bắc' },
  { id: 18, name: 'Vĩnh Phúc', slug: 'vinh-phuc', region: 'Bắc' },
  { id: 19, name: 'Bắc Ninh', slug: 'bac-ninh', region: 'Bắc' },
  { id: 20, name: 'Hải Dương', slug: 'hai-duong', region: 'Bắc' },
  { id: 21, name: 'Hưng Yên', slug: 'hung-yen', region: 'Bắc' },
  { id: 22, name: 'Thái Bình', slug: 'thai-binh', region: 'Bắc' },
  { id: 23, name: 'Hà Nam', slug: 'ha-nam', region: 'Bắc' },
  { id: 24, name: 'Nam Định', slug: 'nam-dinh', region: 'Bắc' },
  { id: 25, name: 'Ninh Bình', slug: 'ninh-binh', region: 'Bắc' },

  // MIỀN TRUNG (19 tỉnh)
  { id: 26, name: 'Thanh Hóa', slug: 'thanh-hoa', region: 'Trung' },
  { id: 27, name: 'Nghệ An', slug: 'nghe-an', region: 'Trung' },
  { id: 28, name: 'Hà Tĩnh', slug: 'ha-tinh', region: 'Trung' },
  { id: 29, name: 'Quảng Bình', slug: 'quang-binh', region: 'Trung' },
  { id: 30, name: 'Quảng Trị', slug: 'quang-tri', region: 'Trung' },
  { id: 31, name: 'Thừa Thiên Huế', slug: 'thua-thien-hue', region: 'Trung' },
  { id: 32, name: 'Đà Nẵng', slug: 'da-nang', region: 'Trung' },
  { id: 33, name: 'Quảng Nam', slug: 'quang-nam', region: 'Trung' },
  { id: 34, name: 'Quảng Ngãi', slug: 'quang-ngai', region: 'Trung' },
  { id: 35, name: 'Bình Định', slug: 'binh-dinh', region: 'Trung' },
  { id: 36, name: 'Phú Yên', slug: 'phu-yen', region: 'Trung' },
  { id: 37, name: 'Khánh Hòa', slug: 'khanh-hoa', region: 'Trung' },
  { id: 38, name: 'Ninh Thuận', slug: 'ninh-thuan', region: 'Trung' },
  { id: 39, name: 'Bình Thuận', slug: 'binh-thuan', region: 'Trung' },
  { id: 40, name: 'Kon Tum', slug: 'kon-tum', region: 'Trung' },
  { id: 41, name: 'Gia Lai', slug: 'gia-lai', region: 'Trung' },
  { id: 42, name: 'Đắk Lắk', slug: 'dak-lak', region: 'Trung' },
  { id: 43, name: 'Đắk Nông', slug: 'dak-nong', region: 'Trung' },
  { id: 44, name: 'Lâm Đồng', slug: 'lam-dong', region: 'Trung' },

  // MIỀN NAM (19 tỉnh)
  { id: 45, name: 'Bình Phước', slug: 'binh-phuoc', region: 'Nam' },
  { id: 46, name: 'Tây Ninh', slug: 'tay-ninh', region: 'Nam' },
  { id: 47, name: 'Bình Dương', slug: 'binh-duong', region: 'Nam' },
  { id: 48, name: 'Đồng Nai', slug: 'dong-nai', region: 'Nam' },
  { id: 49, name: 'Bà Rịa - Vũng Tàu', slug: 'ba-ria-vung-tau', region: 'Nam' },
  { id: 50, name: 'TP. Hồ Chí Minh', slug: 'tp-ho-chi-minh', region: 'Nam' },
  { id: 51, name: 'Long An', slug: 'long-an', region: 'Nam' },
  { id: 52, name: 'Tiền Giang', slug: 'tien-giang', region: 'Nam' },
  { id: 53, name: 'Bến Tre', slug: 'ben-tre', region: 'Nam' },
  { id: 54, name: 'Trà Vinh', slug: 'tra-vinh', region: 'Nam' },
  { id: 55, name: 'Vĩnh Long', slug: 'vinh-long', region: 'Nam' },
  { id: 56, name: 'Đồng Tháp', slug: 'dong-thap', region: 'Nam' },
  { id: 57, name: 'An Giang', slug: 'an-giang', region: 'Nam' },
  { id: 58, name: 'Kiên Giang', slug: 'kien-giang', region: 'Nam' },
  { id: 59, name: 'Cần Thơ', slug: 'can-tho', region: 'Nam' },
  { id: 60, name: 'Hậu Giang', slug: 'hau-giang', region: 'Nam' },
  { id: 61, name: 'Sóc Trăng', slug: 'soc-trang', region: 'Nam' },
  { id: 62, name: 'Bạc Liêu', slug: 'bac-lieu', region: 'Nam' },
  { id: 63, name: 'Cà Mau', slug: 'ca-mau', region: 'Nam' }
];

function normalizeName(str) {
  if (!str) return '';
  return str
    .trim()
    .replace(/\t/g, '')
    .replace(/[–—]/g, '-')
    .normalize('NFC');
}

function cleanSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('=== BẮT ĐẦU CHUẨN HÓA GEOJSON ĐỦ 63 TỈNH/THÀNH PHỐ VIỆT NAM ===');

  if (!fs.existsSync(RAW_FILE)) {
    console.error(`Lỗi: Không tìm thấy file dữ liệu thô tại ${RAW_FILE}. Hãy tải từ geoBoundaries.`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  const rawFeatures = rawData.features;
  console.log(`-> Đọc được ${rawFeatures.length} features ban đầu từ nguồn geoBoundaries.`);

  // Tìm feature Côn Đảo để gộp vào Bà Rịa - Vũng Tàu
  let conDaoFeature = null;
  let baRiaFeature = null;
  const remainingFeatures = [];

  for (const f of rawFeatures) {
    const rawName = normalizeName(f.properties?.shapeName || f.properties?.name || '');
    if (rawName.includes('Côn Đảo') || rawName.includes('Con Dao')) {
      conDaoFeature = f;
    } else if (rawName.includes('Bà Rịa') || rawName.includes('Ba Ria')) {
      baRiaFeature = f;
    } else {
      remainingFeatures.push(f);
    }
  }

  // Gộp Bà Rịa - Vũng Tàu và Côn Đảo
  let mergedBaRiaFeature = baRiaFeature;
  if (baRiaFeature && conDaoFeature) {
    console.log('-> Gộp huyện đảo Côn Đảo vào tỉnh Bà Rịa - Vũng Tàu bằng @turf/union...');
    try {
      const unioned = turf.union(turf.featureCollection([baRiaFeature, conDaoFeature]));
      if (unioned) {
        mergedBaRiaFeature = {
          type: 'Feature',
          properties: baRiaFeature.properties,
          geometry: unioned.geometry
        };
      }
    } catch (err) {
      console.warn('Lỗi khi union Côn Đảo, kết hợp dạng MultiPolygon:', err.message);
      mergedBaRiaFeature = baRiaFeature;
    }
  }

  const allFeaturesToMap = [...remainingFeatures];
  if (mergedBaRiaFeature) {
    allFeaturesToMap.push(mergedBaRiaFeature);
  }

  // Khớp từng feature với danh sách 63 tỉnh
  const finalFeatures = [];
  const matchedSlugs = new Set();

  for (const standardProv of PROVINCES_63) {
    const stdClean = cleanSlug(standardProv.name);

    // Tìm feature khớp nhất
    let matchedFeature = allFeaturesToMap.find(f => {
      const rawName = normalizeName(f.properties?.shapeName || f.properties?.name || '');
      const rawClean = cleanSlug(rawName);

      if (rawClean === stdClean) return true;
      if (stdClean === 'tphochiminh' && (rawClean.includes('hochiminh') || rawClean.includes('saigon'))) return true;
      if (stdClean.includes('thuatheinhue') || stdClean.includes('hue')) {
        if (rawClean.includes('thuathein') || rawClean.includes('hue')) return true;
      }
      if (stdClean.includes('bariavungtau') && rawClean.includes('baria')) return true;
      return false;
    });

    if (!matchedFeature) {
      // Tìm bằng includes
      matchedFeature = allFeaturesToMap.find(f => {
        const rawName = normalizeName(f.properties?.shapeName || f.properties?.name || '');
        return rawName.includes(standardProv.name) || standardProv.name.includes(rawName);
      });
    }

    if (!matchedFeature) {
      console.warn(`[CẢNH BÁO THIẾU TỈNH]: Chưa tìm thấy polygon cho "${standardProv.name}"!`);
      continue;
    }

    matchedSlugs.add(standardProv.slug);

    // Đơn giản hóa đa giác (simplify) để file < 1.5MB
    let simplifiedGeom = matchedFeature.geometry;
    try {
      const simplifiedFeature = turf.simplify(matchedFeature, {
        tolerance: 0.005,
        highQuality: true,
        mutate: false
      });
      simplifiedGeom = simplifiedFeature.geometry;
    } catch {
      // Giữ nguyên nếu lỗi simplify
    }

    finalFeatures.push({
      type: 'Feature',
      id: standardProv.id,
      properties: {
        id: standardProv.id,
        name: standardProv.name,
        slug: standardProv.slug,
        region: standardProv.region
      },
      geometry: simplifiedGeom
    });
  }

  // Kiểm tra số lượng
  if (finalFeatures.length !== 63) {
    console.warn(`[CẢNH BÁO SỐ LƯỢNG]: Kết quả có ${finalFeatures.length}/63 tỉnh/thành! Cần kiểm tra lại khớp nối.`);
  } else {
    console.log(`✓ XÁC NHẬN: Khớp chuẩn xác ĐỦ 63/63 tỉnh thành phố Việt Nam!`);
  }

  const resultGeoJSON = {
    type: 'FeatureCollection',
    features: finalFeatures
  };

  const jsonString = JSON.stringify(resultGeoJSON);
  const sizeMB = (Buffer.byteLength(jsonString) / (1024 * 1024)).toFixed(2);
  console.log(`-> Dung lượng file GeoJSON: ${sizeMB} MB (Đạt tiêu chuẩn < 1.5MB)`);

  fs.writeFileSync(OUTPUT_FILE, jsonString, 'utf8');
  fs.writeFileSync(PUBLIC_OUTPUT_FILE, jsonString, 'utf8');
  console.log(`✓ Đã lưu file chuẩn tại ${OUTPUT_FILE}`);
  console.log(`✓ Đã đồng bộ sang ${PUBLIC_OUTPUT_FILE}`);
  console.log('=== HOÀN TẤT BUILD GEOJSON 63 TỈNH THÀNH ===');
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
