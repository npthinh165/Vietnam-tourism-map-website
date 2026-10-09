import React, { useState, useEffect } from 'react';
import { Province, LocationItem, LocationCategory } from '../types';
import { apiService, fetchVietnamGeoJSON, getPolygonCentroid } from '../services/apiService';
import { 
  ArrowLeft, 
  Heart, 
  CheckCircle2, 
  Star, 
  MapPin, 
  PlusCircle, 
  MessageSquare, 
  BookOpen, 
  Globe2, 
  Utensils, 
  CalendarDays, 
  Landmark as LandmarkIcon,
  Sparkles,
  TrendingUp,
  Users
} from 'lucide-react';

interface ProvinceDetailModalProps {
  province: Province;
  onClose: () => void;
  onOpenReviewModal: (location?: LocationItem) => void;
  onOpenLocationReviews: (location: LocationItem) => void;
  isProvinceVisited: boolean;
  onToggleProvinceVisited: (provinceId: number) => void;
  onRefreshData: () => void;
  onSelectLocationCard?: (location: LocationItem) => void;
}

export const ProvinceDetailModal: React.FC<ProvinceDetailModalProps> = ({
  province,
  onClose,
  onOpenReviewModal,
  onOpenLocationReviews,
  isProvinceVisited,
  onToggleProvinceVisited,
  onRefreshData,
  onSelectLocationCard
}) => {
  // 5 Tabs chuyên biệt: Lịch sử | Địa lý | Đặc sản | Lễ hội | Danh lam thắng cảnh
  const [activeTab, setActiveTab] = useState<LocationCategory>('Food');
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);

  // Tọa độ tâm tỉnh thật tính từ centroid của polygon GeoJSON, không hard-code
  const [trueCentroid, setTrueCentroid] = useState<[number, number]>([province.lat, province.lng]);

  useEffect(() => {
    let isMounted = true;
    const calculateCentroid = async () => {
      try {
        const geoData = await fetchVietnamGeoJSON();
        const feature = geoData.features.find((f: any) => {
          const name = f.properties?.name || '';
          return name === province.name || name.includes(province.name) || province.name.includes(name);
        });
        if (feature && isMounted) {
          const centroid = getPolygonCentroid(feature.geometry);
          setTrueCentroid(centroid);
        }
      } catch (e) {
        // Fallback to province coordinates
      }
    };
    calculateCentroid();
    return () => {
      isMounted = false;
    };
  }, [province]);

  const allProvLocations = apiService.getLocations(province.province_id);
  const tabLocations = allProvLocations.filter(loc => loc.category === activeTab);

  const handleToggleNotebook = (loc: LocationItem, status: 'Visited' | 'Wishlist') => {
    apiService.toggleNotebookLocation(loc, status);
    onRefreshData();
  };

  const notebook = apiService.getNotebook();
  const isLocationInNotebook = (locationId: number, status: 'Visited' | 'Wishlist') => {
    return notebook.some(n => n.location_id === locationId && n.status === status);
  };

  const handleLocationClick = (loc: LocationItem) => {
    setSelectedLocation(loc);
    if (onSelectLocationCard) {
      onSelectLocationCard(loc);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-[#D5E3E3] overflow-hidden">
        
        {/* TOP BAR: Quay lại bản đồ & Tên Tỉnh & Tọa độ tâm thật & Nút Lưu */}
        <div className="px-6 py-4 bg-[#F7FAFA] border-b border-[#D5E3E3] flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-semibold text-[#5B6B7B] hover:text-[#0F9D8F] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-[#0F9D8F]" />
            <span>Quay lại bản đồ</span>
          </button>

          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1F2D3D] uppercase">
              {province.name}
            </h2>
            {/* Tọa độ tâm tỉnh thật tính bằng centroid của polygon */}
            <p className="text-[11px] text-[#0B5F57] font-semibold tabular-nums mt-0.5">
              Miền {province.region} · Tọa độ tâm: {trueCentroid[0].toFixed(3)}°B, {trueCentroid[1].toFixed(3)}°Đ
            </p>
          </div>

          <button
            onClick={() => onToggleProvinceVisited(province.province_id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors ${
              isProvinceVisited
                ? 'bg-[#2E9E5B] text-white border-[#2E9E5B]'
                : 'bg-white text-[#1F2D3D] border-[#D5E3E3] hover:border-[#2E9E5B] hover:text-[#2E9E5B]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProvinceVisited ? 'Đã từng đặt chân' : 'Đánh dấu đã đi'}</span>
          </button>
        </div>

        {/* 5 TABS CHUYÊN BIỆT */}
        <div className="px-6 py-2.5 bg-white border-b border-[#D5E3E3] flex items-center justify-start sm:justify-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('History')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'History'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#E8F4F3] text-[#5B6B7B] hover:text-[#1F2D3D]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lịch sử</span>
          </button>

          <button
            onClick={() => setActiveTab('Geography')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'Geography'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#E8F4F3] text-[#5B6B7B] hover:text-[#1F2D3D]'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Địa lý</span>
          </button>

          <button
            onClick={() => setActiveTab('Food')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'Food'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#E8F4F3] text-[#5B6B7B] hover:text-[#1F2D3D]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Đặc sản ẩm thực</span>
          </button>

          <button
            onClick={() => setActiveTab('Festival')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'Festival'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#E8F4F3] text-[#5B6B7B] hover:text-[#1F2D3D]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Lễ hội</span>
          </button>

          <button
            onClick={() => setActiveTab('Landmark')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'Landmark'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#E8F4F3] text-[#5B6B7B] hover:text-[#1F2D3D]'
            }`}
          >
            <LandmarkIcon className="w-3.5 h-3.5" />
            <span>Danh lam thắng cảnh</span>
          </button>
        </div>

        {/* THÂN MODAL */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CỘT TRÁI: NỘI DUNG VÀ DANH SÁCH ĐỊA ĐIỂM (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Giới thiệu Tab */}
            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3]">
              <h3 className="text-sm font-bold text-[#1F2D3D] mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF8A5B]" />
                {activeTab === 'History' && 'Dấu ấn Lịch sử & Cội nguồn Di sản'}
                {activeTab === 'Geography' && 'Địa lý Tự nhiên & Cảnh quan Sinh thái'}
                {activeTab === 'Food' && 'Ẩm thực Đặc sản & Hương vị Bản xứ'}
                {activeTab === 'Festival' && 'Lễ hội Truyền thống & Văn hóa Dân gian'}
                {activeTab === 'Landmark' && 'Danh lam Thắng cảnh & Điểm Check-in'}
              </h3>
              <p className="text-xs text-[#5B6B7B] leading-relaxed">
                {activeTab === 'History' && (province.history_brief || 'Vùng đất giàu truyền thống văn hóa lịch sử lâu đời của dân tộc.')}
                {activeTab === 'Geography' && (province.geography_brief || 'Địa hình đặc trưng với cảnh quan thiên nhiên trù phú.')}
                {activeTab === 'Food' && `Món ăn đặc sản tiêu biểu của ${province.name}: ${province.specialty_dish || 'Đang cập nhật'}.`}
                {activeTab === 'Festival' && `Lễ hội đặc trưng: ${province.top_festival || 'Đang cập nhật'}.`}
                {activeTab === 'Landmark' && `Danh thắng nổi bật: ${province.top_landmark || 'Đang cập nhật'}.`}
              </p>
            </div>

            {/* Danh sách địa điểm */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-[#1F2D3D] uppercase tracking-wider">
                  {activeTab === 'Food' ? 'Món ăn & Nhà hàng Đặc sản' : 'Địa điểm tiêu biểu'} ({tabLocations.length})
                </h4>
              </div>

              {tabLocations.length === 0 ? (
                /* Trạng thái rỗng thân thiện theo yêu cầu */
                <div className="p-8 text-center bg-[#F7FAFA] rounded-2xl border border-[#D5E3E3]">
                  <p className="text-sm font-semibold text-[#1F2D3D] mb-1">
                    Dữ liệu đang được cập nhật
                  </p>
                  <p className="text-xs text-[#5B6B7B]">
                    Hệ thống đang hoàn thiện bổ sung dữ liệu địa điểm cho danh mục này tại {province.name}. Bạn có thể gửi review để đóng góp nội dung!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tabLocations.map((item, index) => {
                    const isVisited = isLocationInNotebook(item.location_id, 'Visited');
                    const isWishlist = isLocationInNotebook(item.location_id, 'Wishlist');
                    const isSelected = selectedLocation?.location_id === item.location_id;

                    return (
                      <div
                        key={item.location_id}
                        onClick={() => handleLocationClick(item)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#E8F4F3] border-[#0F9D8F] shadow-xs'
                            : 'bg-white border-[#D5E3E3] hover:border-[#A8DCD5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#0F9D8F] tabular-nums">
                                {index + 1}.
                              </span>
                              <h5 className="text-sm font-bold text-[#1F2D3D]">
                                {item.name}
                              </h5>
                              {item.highlight_tag && (
                                <span className="text-[10px] font-semibold text-[#0B5F57] bg-[#E8F4F3] px-2 py-0.5 rounded-md border border-[#A8DCD5]">
                                  {item.highlight_tag}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#5B6B7B] flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-[#FF8A5B] shrink-0" />
                              <span className="truncate max-w-[340px]">{item.address}</span>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-xs font-bold text-[#FF8A5B]">
                              <Star className="w-3.5 h-3.5 fill-[#FF8A5B]" />
                              <span>{item.rating_star}</span>
                            </div>
                            <span className="text-[11px] text-[#5B6B7B] tabular-nums">
                              ({item.review_count} đánh giá)
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#5B6B7B] line-clamp-2 mb-3">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D5E3E3]/60">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleNotebook(item, 'Wishlist');
                              }}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors ${
                                isWishlist
                                  ? 'bg-[#FF8A5B] text-white border-[#FF8A5B]'
                                  : 'bg-[#F7FAFA] text-[#5B6B7B] border-[#D5E3E3] hover:text-[#FF8A5B]'
                              }`}
                            >
                              <Heart className="w-3 h-3" />
                              <span>{isWishlist ? 'Đã thích' : 'Yêu thích'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleNotebook(item, 'Visited');
                              }}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors ${
                                isVisited
                                  ? 'bg-[#2E9E5B] text-white border-[#2E9E5B]'
                                  : 'bg-[#F7FAFA] text-[#5B6B7B] border-[#D5E3E3] hover:text-[#2E9E5B]'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isVisited ? 'Đã đến' : 'Check-in (+50đ)'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLocationReviews(item);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-[#0F9D8F] hover:bg-[#E8F4F3] rounded-lg transition-colors flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Xem Review</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* CỘT PHẢI: BỐ CỤC LẠI HOÀN TOÀN (Ảnh tiêu biểu ở trên, 2 thẻ chỉ số ngay bên dưới) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Ảnh tiêu biểu */}
            <div className="bg-white rounded-2xl border border-[#D5E3E3] overflow-hidden shadow-xs">
              <div className="relative h-60 sm:h-72 bg-slate-100">
                <img
                  src={selectedLocation?.image_url || province.cover_image}
                  alt={selectedLocation?.name || province.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[#A8DCD5]">
                    {selectedLocation ? selectedLocation.category : 'Hình ảnh tiêu biểu'}
                  </span>
                  <h4 className="text-lg font-bold text-white drop-shadow-sm">
                    {selectedLocation?.name || province.name}
                  </h4>
                  <p className="text-xs text-slate-200 mt-1 line-clamp-2">
                    {selectedLocation?.description || province.description}
                  </p>
                </div>
              </div>
            </div>

            {/* HAI THẺ CHỈ SỐ NGAY BÊN DƯỚI (Không còn khoảng trống thừa) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-[#D5E3E3] shadow-xs">
                <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                  <span>Mật độ du khách</span>
                  <TrendingUp className="w-4 h-4 text-[#0F9D8F]" />
                </div>
                <p className="text-lg font-black text-[#0F9D8F] tabular-nums">
                  {province.tourists_million ? `${province.tourists_million} triệu` : `${province.tourist_density}/100`}
                </p>
                <p className="text-[11px] text-[#5B6B7B] mt-0.5">
                  Lượt khách du lịch (2023)
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#D5E3E3] shadow-xs">
                <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                  <span>Tổng GDP đóng góp</span>
                  <Users className="w-4 h-4 text-[#0B5F57]" />
                </div>
                <p className="text-lg font-black text-[#0B5F57] tabular-nums">
                  {province.gdp.toLocaleString('vi-VN')} nghìn tỷ
                </p>
                <p className="text-[11px] text-[#5B6B7B] mt-0.5">
                  Quy mô kinh tế địa phương
                </p>
              </div>
            </div>

            {/* Thông tin văn hóa tóm lược */}
            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-2 text-xs">
              <div className="flex items-start justify-between">
                <span className="font-semibold text-[#1F2D3D]">Đặc sản nổi tiếng:</span>
                <span className="text-[#0F9D8F] font-bold text-right max-w-[200px] truncate">
                  {province.specialty_dish || 'Đang cập nhật'}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="font-semibold text-[#1F2D3D]">Lễ hội tiêu biểu:</span>
                <span className="text-[#FF8A5B] font-bold text-right max-w-[200px] truncate">
                  {province.top_festival || 'Đang cập nhật'}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="font-semibold text-[#1F2D3D]">Quy mô dân số:</span>
                <span className="text-[#1F2D3D] tabular-nums">
                  {(province.population / 1000000).toFixed(2)} triệu người
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 bg-[#F7FAFA] border-t border-[#D5E3E3] flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#1F2D3D]">
              Bạn đã trải nghiệm ẩm thực hoặc danh thắng tại {province.name}?
            </p>
            <p className="text-[11px] text-[#5B6B7B]">
              Đóng góp đánh giá & hình ảnh thực tế để tích lũy +30 điểm hành trình và nhận huy hiệu UGC.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenReviewModal(selectedLocation || tabLocations[0])}
            className="px-5 py-2.5 rounded-xl bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-[#FF8A5B]" />
            <span>+ BẤM ĐỂ ĐĂNG REVIEW VÀ HÌNH ẢNH CỦA BẠN (UGC)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
