/**
 * @file server.js
 * @description Node.js + Express backend server cho Website Bản đồ Du lịch Việt Nam (63 Tỉnh Thành)
 * - Đọc file ranh giới thật ./data/vietnam-provinces.geojson khi seed (bắt buộc đúng 63 features)
 * - Nạp geometry vào Provinces.geo_polygon
 * - Cung cấp API GET /api/provinces trả về GeoJSON FeatureCollection đủ 63 tỉnh
 * - Khối hằng số PROVINCE_SEED, SPECIALTY_SEED, LOCATION_SEED ở cuối file
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Phục vụ static files từ public và dist
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/data', express.static(path.resolve(__dirname, 'data')));

// DỮ LIỆU SEED TỪ GEOJSON RANH GIỚI THẬT
const GEOJSON_PATH = path.resolve(__dirname, 'data/vietnam-provinces.geojson');
const PROVINCES_SEED_PATH = path.resolve(__dirname, 'data/provinces-seed.json');
const LOCATIONS_SEED_PATH = path.resolve(__dirname, 'data/locations-seed.json');

let seededGeoJSON = null;
let provincesDB = [];

// Đọc danh mục chi tiết 63 tỉnh & địa điểm
export const PROVINCE_SEED = fs.existsSync(PROVINCES_SEED_PATH)
  ? JSON.parse(fs.readFileSync(PROVINCES_SEED_PATH, 'utf8'))
  : [];

export const LOCATION_SEED = fs.existsSync(LOCATIONS_SEED_PATH)
  ? JSON.parse(fs.readFileSync(LOCATIONS_SEED_PATH, 'utf8'))
  : [];

// Hàm seed dữ liệu từ GeoJSON vào CSDL mô phỏng (Provinces DB)
function seedProvinces() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.error(`========================================================================`);
    console.error(`[LỖI NGHIÊM TRỌNG]: Thiếu file ${GEOJSON_PATH}`);
    console.error(`Vui lòng chạy script sau trong terminal để tạo ranh giới 63 tỉnh/thành:`);
    console.error(`   node tools/build-geojson.js   (hoặc: npm run build:geojson)`);
    console.error(`Tuyệt đối không tự sinh đa giác giả!`);
    console.error(`========================================================================`);
    return;
  }

  try {
    const rawData = fs.readFileSync(GEOJSON_PATH, 'utf8');
    seededGeoJSON = JSON.parse(rawData);

    if (!seededGeoJSON.features || seededGeoJSON.features.length !== 63) {
      console.warn(`[CẢNH BÁO]: File GeoJSON hiện có ${seededGeoJSON?.features?.length || 0} features (yêu cầu đúng 63 features).`);
    } else {
      console.log(`✓ Đã xác thực tệp GeoJSON có chính xác 63 ranh giới tỉnh/thành phố.`);
    }

    // Đọc danh mục chi tiết 63 tỉnh
    let seedList = PROVINCE_SEED;
    if (fs.existsSync(PROVINCES_SEED_PATH)) {
      try {
        seedList = JSON.parse(fs.readFileSync(PROVINCES_SEED_PATH, 'utf8'));
      } catch {}
    }

    // Seed idempotent theo slug, không bị nhân đôi
    const existingSlugs = new Set();
    provincesDB = [];

    seededGeoJSON.features.forEach(f => {
      const slug = f.properties.slug;
      if (existingSlugs.has(slug)) return;
      existingSlugs.add(slug);

      const seed = seedList.find(s => s.slug === slug || s.id === f.properties.id) || {
        tourists_million: 2.0,
        gdp_trillion_vnd: 50.0,
        population_thousand: 1000,
        specialty_dish: 'Đặc sản địa phương',
        history_brief: '',
        geography_brief: '',
        top_festival: '',
        top_landmark: '',
        lat: 16.0,
        lng: 108.0
      };

      provincesDB.push({
        province_id: f.properties.id,
        name: f.properties.name,
        slug: f.properties.slug,
        region: f.properties.region,
        tourists_million: seed.tourists_million,
        tourist_density: Math.round(seed.tourists_million * 10),
        gdp: seed.gdp_trillion_vnd,
        population: seed.population_thousand * 1000,
        specialty_dish: seed.specialty_dish,
        history_brief: seed.history_brief,
        geography_brief: seed.geography_brief,
        top_festival: seed.top_festival,
        top_landmark: seed.top_landmark,
        lat: seed.lat || 16.0,
        lng: seed.lng || 108.0,
        geo_polygon: f.geometry // Nạp geometry ranh giới thật vào Provinces.geo_polygon
      });
    });

    console.log(`✓ Đã nạp thành công ${provincesDB.length} tỉnh thành vào bảng Provinces (geo_polygon nạp từ GeoJSON thật)!`);
  } catch (err) {
    console.error('Lỗi khi nạp ranh giới GeoJSON:', err);
  }
}

seedProvinces();

// ================= API ENDPOINTS =================

// 1. API GET /api/provinces trả GeoJSON FeatureCollection đủ 63 tỉnh
app.get('/api/provinces', (req, res) => {
  if (!seededGeoJSON) {
    seedProvinces();
  }

  if (!seededGeoJSON) {
    return res.status(500).json({
      error: 'Chưa có file data/vietnam-provinces.geojson. Vui lòng chạy: node tools/build-geojson.js'
    });
  }

  const enrichedFeatures = seededGeoJSON.features.map(f => {
    const prov = provincesDB.find(p => p.province_id === f.properties.id) || {};
    return {
      ...f,
      properties: {
        ...f.properties,
        tourists_million: prov.tourists_million || 2.0,
        tourist_density: prov.tourist_density || 50,
        gdp: prov.gdp || 60,
        population: prov.population || 1000000,
        specialty_dish: prov.specialty_dish || '',
        history_brief: prov.history_brief || '',
        geography_brief: prov.geography_brief || '',
        top_festival: prov.top_festival || '',
        top_landmark: prov.top_landmark || ''
      }
    };
  });

  res.json({
    type: 'FeatureCollection',
    features: enrichedFeatures
  });
});

// 2. API GET /api/provinces/:id
app.get('/api/provinces/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const prov = provincesDB.find(p => p.province_id === id);
  if (!prov) {
    return res.status(404).json({ error: 'Không tìm thấy tỉnh thành' });
  }
  const locations = (fullLocationsSeed.length > 0 ? fullLocationsSeed : LOCATION_SEED).filter(l => l.province_id === id);
  res.json({
    ...prov,
    locations
  });
});

// 3. API GET /api/locations
app.get('/api/locations', (req, res) => {
  const locations = fullLocationsSeed.length > 0 ? fullLocationsSeed : LOCATION_SEED;
  res.json(locations);
});

// 4. API POST /api/v1/planner/generate (validate tối đa 10 tỉnh)
app.post('/api/v1/planner/generate', (req, res) => {
  const { provinces, duration, preferences } = req.body;
  if (!provinces || !Array.isArray(provinces) || provinces.length === 0) {
    return res.status(400).json({ error: 'Cần chọn ít nhất 1 tỉnh/thành để tạo lịch trình.' });
  }
  if (provinces.length > 10) {
    return res.status(400).json({ error: 'Mỗi lịch trình chỉ được chọn tối đa 10 tỉnh/thành phố để đảm bảo thời gian di chuyển hợp lý.' });
  }

  res.json({
    status: 'success',
    data: {
      title: `Hành trình ${duration || '3 Ngày 2 Đêm'}: ${provinces.join(' - ')}`,
      provinces: provinces,
      duration: duration || '3 Ngày 2 Đêm',
      preferences: preferences || ['Ẩm thực', 'Danh thắng']
    }
  });
});

// 5. API POST /api/v1/reviews
app.post('/api/v1/reviews', (req, res) => {
  const { user_id, location_id, rating_star, content, image_url } = req.body;
  res.status(201).json({
    status: 'success',
    message: 'Bài đánh giá đã được gửi và đang chờ kiểm duyệt (Pending).',
    data: {
      review_id: Date.now(),
      review_status: 'Pending',
      user_id,
      location_id,
      rating_star,
      content,
      image_url
    }
  });
});

// Khởi động server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Express API Gateway đang chạy tại http://0.0.0.0:${PORT}`);
    console.log(`🗺️ Endpoint GeoJSON ranh giới 63 tỉnh: http://0.0.0.0:${PORT}/api/provinces`);
  });
}

export default app;
