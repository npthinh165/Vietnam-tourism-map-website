import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { Province, LocationItem, HeatmapMetric, LocationCategory, SeasonType } from '../types';
import { getHeatmapColor, fetchVietnamGeoJSON } from '../services/apiService';
import { 
  Flame, 
  TrendingUp, 
  Users, 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Star, 
  ArrowRight, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Compass, 
  Search,
  ChevronDown
} from 'lucide-react';

interface VietnamMapProps {
  provinces: Province[];
  onSelectProvince: (province: Province) => void;
  selectedProvinceId?: number;
  visitedProvinceIds: number[];
  focusedLocation?: LocationItem | null;
}

// 5 Đô thị trực thuộc Trung ương và các trung tâm du lịch lớn luôn hiện nhãn ở zoom thấp
const MAJOR_CITIES = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'Quảng Ninh', 'Thừa Thiên Huế', 'Khánh Hòa', 'Lâm Đồng', 'Kiên Giang',
  'Thanh Hóa', 'Nghệ An', 'Bình Định', 'Bà Rịa - Vũng Tàu'
];

function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

export const VietnamMap: React.FC<VietnamMapProps> = ({
  provinces,
  onSelectProvince,
  selectedProvinceId,
  visitedProvinceIds,
  focusedLocation
}) => {
  // Bộ lọc
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('tourist_density');
  const [selectedRegion, setSelectedRegion] = useState<'All' | 'Bắc' | 'Trung' | 'Nam'>('All');
  const [selectedSeason, setSelectedSeason] = useState<SeasonType | 'All'>('All');
  const [selectedCategories, setSelectedCategories] = useState<LocationCategory[]>([
    'Food',
    'Landmark',
    'History',
    'Festival',
    'Geography'
  ]);

  // Tìm kiếm Autocomplete không phân biệt dấu
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Trạng thái GeoJSON & Leaflet
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [isLoadingGeoJSON, setIsLoadingGeoJSON] = useState<boolean>(true);
  const [geoJsonError, setGeoJsonError] = useState<string | null>(null);

  // Hover Tooltip / Chi tiết nhanh
  const [hoveredProvince, setHoveredProvince] = useState<Province | null>(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const layersByProvinceSlug = useRef<{ [key: string]: L.Layer }>({});

  // Min & Max cho Heatmap
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    provinces.forEach(p => {
      const val = p[heatmapMetric];
      if (val < min) min = val;
      if (val > max) max = val;
    });
    return { minVal: min === Infinity ? 0 : min, maxVal: max === -Infinity ? 100 : max };
  }, [provinces, heatmapMetric]);

  // Tải dữ liệu GeoJSON ranh giới thật 63 tỉnh
  const loadGeoJSON = async () => {
    setIsLoadingGeoJSON(true);
    setGeoJsonError(null);
    try {
      const data = await fetchVietnamGeoJSON();
      setGeoJsonData(data);
    } catch (err: any) {
      console.error('Lỗi nạp GeoJSON ranh giới:', err);
      setGeoJsonError('Không thể tải ranh giới bản đồ GeoJSON. Vui lòng chạy `node tools/build-geojson.js` hoặc bấm thử lại.');
    } finally {
      setIsLoadingGeoJSON(false);
    }
  };

  useEffect(() => {
    loadGeoJSON();
  }, []);

  // KHỞI TẠO BẢN ĐỒ CHÍNH (LEAFLET + CANVAS RENDERER)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Giới hạn lat 6-24, lng 100-118
    const southWest = L.latLng(6.0, 100.0);
    const northEast = L.latLng(24.5, 118.0);
    const bounds = L.latLngBounds(southWest, northEast);

    // Dùng L.canvas() renderer cho độ mượt cao
    const canvasRenderer = L.canvas({ padding: 0.5 });

    const map = L.map(mapContainerRef.current, {
      maxBounds: bounds,
      maxBoundsViscosity: 0.85,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: false,
      renderer: canvasRenderer
    });

    // Mặc định fitBounds vừa khít phần đất liền
    map.fitBounds(L.latLngBounds([8.4, 102.0], [23.4, 109.8]), {
      padding: [20, 20]
    });

    // CARTO Positron không nhãn
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Lớp marker đảo và vùng biển thiêng liêng
    const islandLayer = L.layerGroup().addTo(map);

    const makeIslandIcon = (text: string) => L.divIcon({
      className: 'vn-island-label',
      html: `
        <div class="vn-island-chip">
          <span class="vn-island-dot"></span>
          <span>${text}</span>
        </div>
      `,
      iconSize: [200, 24],
      iconAnchor: [100, 12]
    });

    L.marker([16.5, 112.0], { icon: makeIslandIcon('Quần đảo Hoàng Sa (TP. Đà Nẵng)') }).addTo(islandLayer);
    L.marker([9.5, 114.0], { icon: makeIslandIcon('Quần đảo Trường Sa (Khánh Hòa)') }).addTo(islandLayer);
    L.marker([10.22, 103.96], { icon: makeIslandIcon('Đảo Phú Quốc (Kiên Giang)') }).addTo(islandLayer);
    L.marker([8.68, 106.60], { icon: makeIslandIcon('Côn Đảo (Bà Rịa - Vũng Tàu)') }).addTo(islandLayer);

    const bienDongIcon = L.divIcon({
      className: 'vn-island-label',
      html: `<div class="vn-sea-watermark">BIỂN ĐÔNG (VIETNAM SEA)</div>`,
      iconSize: [260, 30],
      iconAnchor: [130, 15]
    });
    L.marker([14.5, 113.5], { icon: bienDongIcon }).addTo(islandLayer);

    // Zoom listener điều khiển ẩn/hiện nhãn tỉnh nhỏ
    const updateZoomClass = () => {
      const zoom = map.getZoom();
      const container = mapContainerRef.current;
      if (container) {
        if (zoom < 7) {
          container.classList.add('zoom-low');
        } else {
          container.classList.remove('zoom-low');
        }
      }
    };

    map.on('zoomend', updateZoomClass);
    updateZoomClass();

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Khi click thẻ địa điểm từ modal/danh sách: bản đồ chính flyTo marker tương ứng
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusedLocation) return;
    map.flyTo([focusedLocation.lat, focusedLocation.lng], 11, {
      duration: 1.0
    });
    const popup = L.popup()
      .setLatLng([focusedLocation.lat, focusedLocation.lng])
      .setContent(`
        <div style="font-family: inherit; font-size: 12px; padding: 3px; min-width: 140px;">
          <strong style="color: #0F9D8F; font-size: 13px;">${focusedLocation.name}</strong><br/>
          <span style="color: #5B6B7B; font-size: 11px;">${focusedLocation.category} · ★ ${focusedLocation.rating_star}</span>
        </div>
      `)
      .openOn(map);
  }, [focusedLocation]);

  // VẼ 63 TỈNH BẰNG L.geoJSON
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJsonData) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    layersByProvinceSlug.current = {};

    const geoLayer = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const featureName = feature?.properties?.name || '';
        const prov = provinces.find(p => p.name === featureName || featureName.includes(p.name) || p.name.includes(featureName));
        const val = prov ? prov[heatmapMetric] : minVal;
        const heat = getHeatmapColor(val, minVal, maxVal);
        const isSelected = prov && prov.province_id === selectedProvinceId;
        const isVisited = prov && visitedProvinceIds.includes(prov.province_id);

        return {
          weight: isSelected ? 3 : 1.5,
          color: isSelected ? '#FF8A5B' : isVisited ? '#2E9E5B' : '#FFFFFF',
          opacity: 1,
          fillColor: heat.color,
          fillOpacity: 0.88
        };
      },
      onEachFeature: (feature, layer) => {
        const featureName = feature?.properties?.name || '';
        const slug = feature?.properties?.slug || '';
        const prov = provinces.find(p => p.name === featureName || featureName.includes(p.name) || p.name.includes(featureName));
        const displayName = prov ? prov.name : featureName;
        const isMajor = MAJOR_CITIES.some(m => displayName.includes(m));

        if (slug) {
          layersByProvinceSlug.current[slug] = layer;
        }

        // Nhãn tooltip permanent
        layer.bindTooltip(displayName, {
          permanent: true,
          direction: 'center',
          className: isMajor ? 'vn-province-tooltip' : 'vn-province-tooltip vn-minor-province'
        });

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 3,
              color: '#0F9D8F',
              fillOpacity: 0.98
            });
            l.bringToFront();
            if (prov) {
              setHoveredProvince(prov);
            }
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target);
          },
          click: (e) => {
            const l = e.target;
            map.flyToBounds(l.getBounds(), {
              padding: [50, 50],
              duration: 0.8
            });
            if (prov) {
              onSelectProvince(prov);
            }
          }
        });
      }
    });

    geoLayer.addTo(map);
    geoJsonLayerRef.current = geoLayer;
  }, [geoJsonData, provinces, heatmapMetric, minVal, maxVal, selectedProvinceId, visitedProvinceIds, onSelectProvince]);

  // Lọc danh sách tỉnh theo vùng miền và tìm kiếm
  const filteredProvinces = useMemo(() => {
    return provinces.filter(p => {
      // Lọc theo miền
      if (selectedRegion !== 'All' && p.region !== selectedRegion) {
        return false;
      }
      // Lọc theo từ khóa
      if (searchQuery.trim() !== '') {
        const q = removeVietnameseTones(searchQuery);
        const nameNorm = removeVietnameseTones(p.name);
        const dishNorm = removeVietnameseTones(p.specialty_dish);
        return nameNorm.includes(q) || dishNorm.includes(q);
      }
      return true;
    });
  }, [provinces, selectedRegion, searchQuery]);

  // Autocomplete kết quả
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = removeVietnameseTones(searchQuery);
    return provinces.filter(p => removeVietnameseTones(p.name).includes(q)).slice(0, 8);
  }, [provinces, searchQuery]);

  // Chọn tỉnh từ autocomplete
  const handleSelectSearchResult = (prov: Province) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    onSelectProvince(prov);

    const layer = prov.slug ? (layersByProvinceSlug.current[prov.slug] as any) : null;
    if (layer && mapInstanceRef.current) {
      mapInstanceRef.current.flyToBounds(layer.getBounds(), {
        padding: [60, 60],
        duration: 0.8
      });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([prov.lat, prov.lng], 9, { duration: 0.8 });
    }
  };

  const getMetricLabel = () => {
    if (heatmapMetric === 'tourist_density') return 'Mật độ khách du lịch';
    if (heatmapMetric === 'gdp') return 'Chỉ số GDP tỉnh thành';
    return 'Quy mô dân số địa phương';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* CỘT TRÁI: BỘ LỌC THÔNG MINH (4 cols) */}
      <div className="lg:col-span-4 space-y-5">
        
        <div className="bg-white rounded-2xl p-5 border border-[#D5E3E3] shadow-xs">
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#D5E3E3]">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#0F9D8F]" />
              <h2 className="text-base font-bold text-[#1F2D3D]">Bộ Lọc Đủ 63 Tỉnh Thành</h2>
            </div>
            <span className="text-xs font-semibold text-[#0F9D8F] bg-[#E8F4F3] px-2 py-0.5 rounded-md">
              {filteredProvinces.length} / 63 tỉnh
            </span>
          </div>

          {/* Bộ lọc nhanh theo Miền (Bắc / Trung / Nam) */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#1F2D3D] uppercase tracking-wider mb-2">
              Lọc nhanh theo Miền
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedRegion('All')}
                className={`py-2 rounded-xl border text-center font-semibold transition-colors ${
                  selectedRegion === 'All'
                    ? 'border-[#0F9D8F] bg-[#0F9D8F] text-white shadow-xs'
                    : 'border-[#D5E3E3] bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D]'
                }`}
              >
                Tất cả (63)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRegion('Bắc')}
                className={`py-2 rounded-xl border text-center font-semibold transition-colors ${
                  selectedRegion === 'Bắc'
                    ? 'border-[#0F9D8F] bg-[#0F9D8F] text-white shadow-xs'
                    : 'border-[#D5E3E3] bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D]'
                }`}
              >
                Bắc (25)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRegion('Trung')}
                className={`py-2 rounded-xl border text-center font-semibold transition-colors ${
                  selectedRegion === 'Trung'
                    ? 'border-[#0F9D8F] bg-[#0F9D8F] text-white shadow-xs'
                    : 'border-[#D5E3E3] bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D]'
                }`}
              >
                Trung (19)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRegion('Nam')}
                className={`py-2 rounded-xl border text-center font-semibold transition-colors ${
                  selectedRegion === 'Nam'
                    ? 'border-[#0F9D8F] bg-[#0F9D8F] text-white shadow-xs'
                    : 'border-[#D5E3E3] bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D]'
                }`}
              >
                Nam (19)
              </button>
            </div>
          </div>

          {/* Dropdown chọn tỉnh theo nhóm miền */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#5B6B7B] uppercase tracking-wider mb-1.5">
              Chọn tỉnh thành trong danh sách:
            </label>
            <select
              value={selectedProvinceId || ''}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                const prov = provinces.find(p => p.province_id === id);
                if (prov) {
                  handleSelectSearchResult(prov);
                }
              }}
              className="w-full px-3.5 py-2 text-xs bg-[#F7FAFA] border border-[#D5E3E3] rounded-xl text-[#1F2D3D] focus:outline-hidden focus:border-[#0F9D8F]"
            >
              <option value="">-- Chọn trong 63 tỉnh/thành phố --</option>
              <optgroup label="Miền Bắc (25 tỉnh)">
                {provinces.filter(p => p.region === 'Bắc').map(p => (
                  <option key={p.province_id} value={p.province_id}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="Miền Trung (19 tỉnh)">
                {provinces.filter(p => p.region === 'Trung').map(p => (
                  <option key={p.province_id} value={p.province_id}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="Miền Nam (19 tỉnh)">
                {provinces.filter(p => p.region === 'Nam').map(p => (
                  <option key={p.province_id} value={p.province_id}>{p.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 1. Bộ lọc chế độ Heatmap */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#1F2D3D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#FF8A5B]" />
              Chế độ bản đồ nhiệt (Heatmap)
            </label>
            <div className="space-y-2">
              <label 
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  heatmapMetric === 'tourist_density'
                    ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-semibold'
                    : 'border-[#D5E3E3] hover:bg-[#F7FAFA] text-[#1F2D3D]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="heatmapMetric"
                    checked={heatmapMetric === 'tourist_density'}
                    onChange={() => setHeatmapMetric('tourist_density')}
                    className="accent-[#0F9D8F]"
                  />
                  <span>Mật độ du khách (2023)</span>
                </div>
                <span className="text-[11px] text-[#5B6B7B]">Phổ biến nhất</span>
              </label>

              <label 
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  heatmapMetric === 'gdp'
                    ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-semibold'
                    : 'border-[#D5E3E3] hover:bg-[#F7FAFA] text-[#1F2D3D]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="heatmapMetric"
                    checked={heatmapMetric === 'gdp'}
                    onChange={() => setHeatmapMetric('gdp')}
                    className="accent-[#0F9D8F]"
                  />
                  <span>Chỉ số GDP kinh tế</span>
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-[#0F9D8F]" />
              </label>

              <label 
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  heatmapMetric === 'population'
                    ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-semibold'
                    : 'border-[#D5E3E3] hover:bg-[#F7FAFA] text-[#1F2D3D]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="heatmapMetric"
                    checked={heatmapMetric === 'population'}
                    onChange={() => setHeatmapMetric('population')}
                    className="accent-[#0F9D8F]"
                  />
                  <span>Quy mô dân số</span>
                </div>
                <Users className="w-3.5 h-3.5 text-[#0F9D8F]" />
              </label>
            </div>
          </div>

          {/* Lọc theo mùa */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2D3D] uppercase tracking-wider mb-1.5">
              Lọc theo mùa trong năm
            </label>
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value as SeasonType | 'All')}
              className="w-full px-3.5 py-2 text-xs bg-[#F7FAFA] border border-[#D5E3E3] rounded-xl text-[#1F2D3D] focus:outline-hidden focus:border-[#0F9D8F]"
            >
              <option value="All">Tất cả các mùa quanh năm</option>
              <option value="Spring">Mùa Xuân (Lễ hội & Cầu may)</option>
              <option value="Summer">Mùa Hè (Biển đảo & Nghỉ dưỡng)</option>
              <option value="Autumn">Mùa Thu (Phố cổ & Mùa lúa chín)</option>
              <option value="Winter">Mùa Đông (Săn mây & Đèo cao)</option>
            </select>
          </div>

        </div>

        {/* Chú giải Thang màu Heatmap */}
        <div className="bg-white rounded-2xl p-4 border border-[#D5E3E3] shadow-xs">
          <p className="text-xs font-bold text-[#1F2D3D] mb-2 flex items-center justify-between">
            <span>Thang màu Heatmap: {getMetricLabel()}</span>
            <span className="text-[11px] font-normal text-[#5B6B7B]">5 cấp độ</span>
          </p>

          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-medium mb-2">
            <div className="py-1 rounded-sm bg-[#E6F5F3] text-[#1F2D3D] border border-[#D5E3E3]">Thấp nhất</div>
            <div className="py-1 rounded-sm bg-[#A8DCD5] text-[#1F2D3D]">Thấp</div>
            <div className="py-1 rounded-sm bg-[#5CC0B4] text-[#1F2D3D]">Trung bình</div>
            <div className="py-1 rounded-sm bg-[#1F9E91] text-white">Cao</div>
            <div className="py-1 rounded-sm bg-[#0B5F57] text-white">Cao nhất</div>
          </div>
        </div>

      </div>

      {/* CỘT PHẢI: BẢN ĐỒ LEAFLET 63 TỈNH (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-[#D5E3E3] shadow-xs relative overflow-hidden min-h-[750px] flex flex-col justify-between">
        
        {/* Thanh công cụ bản đồ kèm Ô TÌM KIẾM AUTOCOMPLETE ở góc */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D5E3E3] mb-3 z-10 bg-white/95">
          <div>
            <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#0F9D8F]" />
              Bản Đồ 63 Tỉnh Thành Việt Nam (Leaflet · CARTO Positron)
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Tất cả 63 polygon ranh giới thật · Click để phóng to và mở chi tiết
            </p>
          </div>

          <div className="flex items-center gap-2">
            
            {/* Ô TÌM KIẾM AUTOCOMPLETE (Không phân biệt dấu) ở góc bản đồ */}
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7FAFA] border border-[#D5E3E3] rounded-xl text-xs focus-within:border-[#0F9D8F] focus-within:ring-1 focus-within:ring-[#0F9D8F]">
                <Search className="w-3.5 h-3.5 text-[#5B6B7B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Tìm tỉnh/thành..."
                  className="bg-transparent focus:outline-hidden w-28 sm:w-36 text-xs text-[#1F2D3D]"
                />
              </div>

              {/* Menu Autocomplete */}
              {isSearchOpen && searchResults.length > 0 && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-[#D5E3E3] py-1 z-50 animate-in fade-in max-h-60 overflow-y-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.province_id}
                      type="button"
                      onClick={() => handleSelectSearchResult(p)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[#E8F4F3] flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-[#1F2D3D]">{p.name}</span>
                      <span className="text-[10px] text-[#0F9D8F]">Miền {p.region}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#F7FAFA] border border-[#D5E3E3] rounded-lg p-1">
              <button
                onClick={() => mapInstanceRef.current?.zoomIn()}
                className="p-1.5 rounded-md hover:bg-white text-[#1F2D3D] transition-colors"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => mapInstanceRef.current?.zoomOut()}
                className="p-1.5 rounded-md hover:bg-white text-[#1F2D3D] transition-colors"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  mapInstanceRef.current?.fitBounds(L.latLngBounds([8.4, 102.0], [23.4, 109.8]), {
                    padding: [20, 20]
                  });
                }}
                className="p-1.5 rounded-md hover:bg-white text-[#1F2D3D] transition-colors"
                title="Đặt lại toàn cảnh"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Khung bản đồ Leaflet */}
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-[#D5E3E3] min-h-[620px] bg-[#f2f6f6]">
          <div
            ref={mapContainerRef}
            className="w-full h-full absolute inset-0 z-0"
          />

          {isLoadingGeoJSON && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
              <div className="w-8 h-8 border-3 border-[#0F9D8F] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-bold text-[#1F2D3D]">Đang nạp dữ liệu ranh giới 63 tỉnh/thành...</p>
            </div>
          )}

          {geoJsonError && (
            <div className="absolute top-4 left-4 right-4 z-30 p-4 rounded-2xl bg-red-50 border border-red-200 shadow-md text-xs text-[#E5484D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{geoJsonError}</span>
              </div>
              <button
                onClick={loadGeoJSON}
                className="px-3 py-1.5 bg-[#0F9D8F] text-white font-bold rounded-lg hover:bg-[#0B7C71] flex items-center gap-1 transition-colors shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {hoveredProvince && (
            <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-xs p-3.5 rounded-2xl shadow-lg border border-[#D5E3E3] max-w-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h4 className="text-sm font-bold text-[#1F2D3D]">
                  {hoveredProvince.name}
                </h4>
                <div className="flex items-center gap-1 text-xs font-bold text-[#FF8A5B]">
                  <Star className="w-3.5 h-3.5 fill-[#FF8A5B]" />
                  <span>{hoveredProvince.avg_rating}</span>
                </div>
              </div>
              <p className="text-xs text-[#0B5F57] font-semibold mb-1">
                {getMetricLabel()}: {heatmapMetric === 'gdp' ? `${hoveredProvince.gdp} tỷ VNĐ` : `${hoveredProvince.tourist_density}/100 điểm`}
              </p>
              <button
                onClick={() => onSelectProvince(hoveredProvince)}
                className="w-full py-1.5 px-3 bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors"
              >
                <span>Xem chi tiết tỉnh thành</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#D5E3E3] mt-2 flex flex-wrap items-center justify-between text-xs text-[#5B6B7B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0F9D8F]"></span>
            Chủ quyền: Quần đảo Hoàng Sa & Quần đảo Trường Sa thuộc chủ quyền thiêng liêng của Việt Nam.
          </span>
          <span className="font-medium text-[#0F9D8F]">
            63 Tỉnh Thành · L.canvas() Renderer
          </span>
        </div>

      </div>

    </div>
  );
};
