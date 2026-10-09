import React, { useState } from 'react';
import { Province, SavedItinerary } from '../types';
import { apiService, calculateHaversineDistance } from '../services/apiService';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Utensils, 
  Landmark, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Bookmark, 
  RotateCcw, 
  Navigation,
  Car,
  Compass,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TravelPlannerProps {
  provinces: Province[];
  onSavedToNotebook: () => void;
  onOpenNotebook: () => void;
}

export const TravelPlanner: React.FC<TravelPlannerProps> = ({
  provinces,
  onSavedToNotebook,
  onOpenNotebook
}) => {
  // BƯỚC 1: TÙY CHỌN
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(['Đà Nẵng', 'Thừa Thiên Huế']);
  const [duration, setDuration] = useState<string>('3 Ngày 2 Đêm');
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([
    'Ẩm thực',
    'Di tích lịch sử',
    'Biển đảo'
  ]);
  const [plannerSearch, setPlannerSearch] = useState<string>('');
  const [plannerRegion, setPlannerRegion] = useState<'All' | 'Bắc' | 'Trung' | 'Nam'>('All');
  const [validationError, setValidationError] = useState<string | null>(null);

  // BƯỚC 2: KẾT QUẢ GỢI Ý
  const [generatedItinerary, setGeneratedItinerary] = useState<SavedItinerary | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Quick preset itineraries
  const PRESET_ROUTES = [
    { title: 'Con đường Di sản Miền Trung', list: ['Đà Nẵng', 'Thừa Thiên Huế'], time: '3 Ngày 2 Đêm' },
    { title: 'Tam giác vàng Đông Bắc', list: ['Hà Nội', 'Quảng Ninh', 'Ninh Bình'], time: '4 Ngày 3 Đêm' },
    { title: 'Thiên đường Hoa & Biển', list: ['Lâm Đồng', 'Khánh Hòa'], time: '3 Ngày 2 Đêm' },
    { title: 'Hùng vĩ Cung đèo Tây Bắc', list: ['Hà Nội', 'Lào Cai', 'Hà Giang'], time: '5 Ngày 4 Đêm' },
    { title: 'Sông nước Nam Bộ & Phú Quốc', list: ['TP. Hồ Chí Minh', 'Cần Thơ', 'Kiên Giang'], time: '4 Ngày 3 Đêm' }
  ];

  const toggleProvince = (name: string) => {
    setValidationError(null);
    if (selectedProvinces.includes(name)) {
      if (selectedProvinces.length > 1) {
        setSelectedProvinces(selectedProvinces.filter(p => p !== name));
      } else {
        setValidationError('Vui lòng chọn ít nhất 1 tỉnh/thành phố để lên lịch trình.');
      }
    } else {
      if (selectedProvinces.length >= 10) {
        setValidationError('Giới hạn tối đa 10 tỉnh/thành phố cho mỗi lịch trình để đảm bảo lộ trình di chuyển hợp lý.');
        return;
      }
      setSelectedProvinces([...selectedProvinces, name]);
    }
  };

  const togglePreference = (pref: string) => {
    if (selectedPreferences.includes(pref)) {
      if (selectedPreferences.length > 1) {
        setSelectedPreferences(selectedPreferences.filter(p => p !== pref));
      }
    } else {
      setSelectedPreferences([...selectedPreferences, pref]);
    }
  };

  // Algorithm Execution: Tuân thủ lưu đồ Activity Diagram
  const handleGenerateItinerary = () => {
    setValidationError(null);
    if (selectedProvinces.length === 0) {
      setValidationError('Dữ liệu không hợp lệ: Cần chọn ít nhất 1 tỉnh/thành phố.');
      return;
    }
    if (selectedProvinces.length > 10) {
      setValidationError('Mỗi lịch trình chỉ được chọn tối đa 10 tỉnh thành.');
      return;
    }

    setIsGenerating(true);
    // Simulate core backend computation
    setTimeout(() => {
      const plan = apiService.generateOptimalItinerary(selectedProvinces, duration, selectedPreferences);
      setGeneratedItinerary(plan);
      setIsGenerating(false);
      setSaveSuccessMessage(null);
    }, 450);
  };

  const handleSaveToNotebook = () => {
    if (!generatedItinerary) return;
    apiService.saveItineraryToNotebook(generatedItinerary);
    setSaveSuccessMessage(`Đã lưu thành công "${generatedItinerary.title}" vào Sổ tay du lịch của bạn! (+40 điểm)`);
    
    // Celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    onSavedToNotebook();
  };

  const handleReset = () => {
    setGeneratedItinerary(null);
    setSaveSuccessMessage(null);
  };

  // Calculate total route distance for selected provinces
  const routeDistance = React.useMemo(() => {
    if (selectedProvinces.length < 2) return 85;
    let total = 0;
    const selectedObjs = selectedProvinces.map(name => provinces.find(p => p.name === name)).filter(Boolean) as Province[];
    for (let i = 0; i < selectedObjs.length - 1; i++) {
      total += calculateHaversineDistance(
        selectedObjs[i].lat,
        selectedObjs[i].lng,
        selectedObjs[i + 1].lat,
        selectedObjs[i + 1].lng
      );
    }
    return total;
  }, [selectedProvinces, provinces]);

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F9D8F] bg-[#E8F4F3] px-2.5 py-1 rounded-md border border-[#A8DCD5]">
              Core Logic · Travel Planner Tối Ưu
            </span>
            <h1 className="text-2xl font-black text-[#1F2D3D] mt-2 tracking-tight">
              Gợi Ý Lịch Trình Tự Động (Travel Planner)
            </h1>
            <p className="text-xs text-[#5B6B7B] mt-1 max-w-2xl">
              Hệ thống sử dụng thuật toán tối ưu khoảng cách Haversine, sắp xếp tuyến đường thông minh và tự động ghép nối các món ăn đặc sản nổi tiếng theo từng khung giờ di chuyển.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotebook}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D5E3E3] bg-[#F7FAFA] hover:bg-[#E8F4F3] text-[#1F2D3D] flex items-center gap-2 transition-colors"
            >
              <Bookmark className="w-4 h-4 text-[#0F9D8F]" />
              <span>Xem Sổ tay đã lưu</span>
            </button>
          </div>
        </div>

        {/* Quick Route Presets */}
        <div className="mt-5 pt-4 border-t border-[#D5E3E3]">
          <p className="text-xs font-bold text-[#5B6B7B] uppercase tracking-wider mb-2">
            Gợi ý tuyến đường phổ biến:
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_ROUTES.map(preset => (
              <button
                key={preset.title}
                type="button"
                onClick={() => {
                  setSelectedProvinces(preset.list);
                  setDuration(preset.time);
                  setGeneratedItinerary(null);
                  setSaveSuccessMessage(null);
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border text-left transition-colors flex items-center gap-1.5 ${
                  JSON.stringify(selectedProvinces.sort()) === JSON.stringify(preset.list.sort())
                    ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-semibold'
                    : 'border-[#D5E3E3] bg-white text-[#5B6B7B] hover:border-[#0F9D8F] hover:text-[#1F2D3D]'
                }`}
              >
                <span>{preset.title}</span>
                <span className="text-[10px] text-[#0F9D8F]">({preset.time})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CHIA 2 CỘT THEO ĐÚNG WIREFRAME: BƯỚC 1 (Bên trái) | BƯỚC 2 (Bên phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* BƯỚC 1: TÙY CHỌN (BÊN TRÁI - 5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#D5E3E3]">
            <h2 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0F9D8F] text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              BƯỚC 1: TÙY CHỌN CHUYẾN ĐI
            </h2>
            <p className="text-xs text-[#5B6B7B] mt-0.5">
              Chọn điểm đến, thời gian và sở thích của bạn
            </p>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E5484D] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Tỉnh/Thành muốn đi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1F2D3D] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0F9D8F]" />
                Tỉnh / Thành phố ({selectedProvinces.length}/10 tối đa)
              </label>
              <span className="text-[11px] text-[#5B6B7B]">Chọn 1 đến 10 tỉnh</span>
            </div>

            {/* Quick search and region filter */}
            <div className="space-y-2 mb-2">
              <input
                type="text"
                value={plannerSearch}
                onChange={e => setPlannerSearch(e.target.value)}
                placeholder="Tìm nhanh tỉnh trong 63 tỉnh..."
                className="w-full px-3 py-1.5 text-xs bg-[#F7FAFA] border border-[#D5E3E3] rounded-lg focus:outline-hidden focus:border-[#0F9D8F]"
              />

              <div className="grid grid-cols-4 gap-1 text-[11px]">
                {(['All', 'Bắc', 'Trung', 'Nam'] as const).map(reg => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setPlannerRegion(reg)}
                    className={`py-1 rounded-md border text-center transition-colors ${
                      plannerRegion === reg
                        ? 'bg-[#0F9D8F] text-white font-bold border-[#0F9D8F]'
                        : 'bg-white text-[#5B6B7B] border-[#D5E3E3] hover:text-[#1F2D3D]'
                    }`}
                  >
                    {reg === 'All' ? 'Tất cả 63' : `Miền ${reg}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-1.5 border border-[#D5E3E3] rounded-xl bg-[#F7FAFA]">
              {provinces
                .filter(p => plannerRegion === 'All' || p.region === plannerRegion)
                .filter(p => !plannerSearch.trim() || p.name.toLowerCase().includes(plannerSearch.toLowerCase()))
                .map(prov => {
                  const isChecked = selectedProvinces.includes(prov.name);
                  return (
                    <button
                      key={prov.province_id}
                      type="button"
                      onClick={() => toggleProvince(prov.name)}
                      className={`p-1.5 text-xs rounded-lg border text-left transition-colors flex items-center justify-between ${
                        isChecked
                          ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-semibold'
                          : 'border-[#D5E3E3] bg-white text-[#5B6B7B] hover:bg-[#F7FAFA]'
                      }`}
                    >
                      <span className="truncate">{prov.name}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0" />}
                    </button>
                  );
                })}
            </div>

            {/* Selected preview chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {selectedProvinces.map(name => (
                <span
                  key={name}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-[#E8F4F3] text-[#0B5F57] border border-[#A8DCD5] flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3 text-[#0F9D8F]" />
                  {name}
                  <button
                    type="button"
                    onClick={() => toggleProvince(name)}
                    className="ml-1 text-[#5B6B7B] hover:text-[#E5484D]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 2. Thời gian chuyến đi */}
          <div>
            <label className="block text-xs font-bold text-[#1F2D3D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0F9D8F]" />
              Thời gian chuyến đi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {['1 Ngày', '2 Ngày 1 Đêm', '3 Ngày 2 Đêm', '4 Ngày 3 Đêm', '5 Ngày 4 Đêm'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`p-2.5 rounded-xl border text-center transition-colors font-medium ${
                    duration === d
                      ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-bold shadow-xs'
                      : 'border-[#D5E3E3] bg-white text-[#5B6B7B] hover:bg-[#F7FAFA]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Sở thích du lịch */}
          <div>
            <label className="block text-xs font-bold text-[#1F2D3D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF8A5B]" />
              Sở thích trải nghiệm
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { name: 'Ẩm thực', desc: 'Món ngon bản xứ' },
                { name: 'Di tích lịch sử', desc: 'Văn hóa cổ truyền' },
                { name: 'Biển đảo', desc: 'Nghỉ dưỡng & Tắm biển' },
                { name: 'Nghỉ dưỡng núi', desc: 'Săn mây & Không khí mát' },
                { name: 'Check-in sống ảo', desc: 'Cảnh đẹp độc đáo' },
                { name: 'Sinh thái miệt vườn', desc: 'Trải nghiệm làng nghề' }
              ].map(pref => {
                const isSelected = selectedPreferences.includes(pref.name);
                return (
                  <button
                    key={pref.name}
                    type="button"
                    onClick={() => togglePreference(pref.name)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-medium'
                        : 'border-[#D5E3E3] bg-white text-[#5B6B7B] hover:bg-[#F7FAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1F2D3D]">{pref.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0F9D8F]" />}
                    </div>
                    <span className="text-[10px] text-[#5B6B7B] block mt-0.5">{pref.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metric Estimates */}
          <div className="p-3.5 rounded-xl bg-[#F7FAFA] border border-[#D5E3E3] flex items-center justify-between text-xs text-[#5B6B7B]">
            <span className="flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[#0F9D8F]" />
              Ước tính quãng đường:
            </span>
            <span className="font-bold text-[#1F2D3D] tabular-nums">
              ~{routeDistance} km di chuyển
            </span>
          </div>

          {/* NÚT TẠO LỊCH TRÌNH */}
          <button
            type="button"
            onClick={handleGenerateItinerary}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-xl bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Đang chạy thuật toán tối ưu lộ trình...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>TẠO LỊCH TRÌNH (Tối ưu hóa)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </div>

        {/* BƯỚC 2: KẾT QUẢ GỢI Ý (BÊN PHẢI - 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {saveSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-[#2E9E5B] flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{saveSuccessMessage}</span>
              </div>
              <button
                onClick={onOpenNotebook}
                className="px-3 py-1 bg-white text-[#2E9E5B] font-bold rounded-lg border border-emerald-300 hover:bg-emerald-100 transition-colors shrink-0"
              >
                Mở Sổ tay ngay
              </button>
            </div>
          )}

          {!generatedItinerary ? (
            /* Trạng thái chưa tạo lịch trình */
            <div className="bg-white rounded-2xl p-12 border border-[#D5E3E3] shadow-xs text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F4F3] border border-[#A8DCD5] flex items-center justify-center text-[#0F9D8F] mb-4">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#1F2D3D]">
                Sẵn Sàng Cho Chuyến Đi Tuyệt Vời
              </h3>
              <p className="text-xs text-[#5B6B7B] max-w-md mt-1.5 leading-relaxed">
                Hãy chọn các tỉnh thành mong muốn bên trái và nhấn <span className="font-bold text-[#0F9D8F]">"TẠO LỊCH TRÌNH"</span>. Thuật toán sẽ phân bổ thời gian tham quan danh lam thắng cảnh và ghép nối thực đơn ẩm thực theo ngày.
              </p>
              <div className="mt-6 flex items-center gap-2">
                <button
                  onClick={handleGenerateItinerary}
                  className="px-5 py-2.5 rounded-xl bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Tạo lịch trình mẫu ngay
                </button>
              </div>
            </div>
          ) : (
            /* Kết quả Lịch trình gợi ý */
            <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-6 animate-in fade-in duration-300">
              
              {/* Header Lịch trình */}
              <div className="pb-4 border-b border-[#D5E3E3] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B5F57] bg-[#E8F4F3] px-2 py-0.5 rounded-sm">
                    {generatedItinerary.duration}
                  </span>
                  <h3 className="text-lg font-extrabold text-[#1F2D3D] mt-1">
                    {generatedItinerary.title}
                  </h3>
                  <p className="text-xs text-[#5B6B7B] flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0F9D8F]" />
                    Lộ trình: {generatedItinerary.provinces.join(' ➔ ')} · {generatedItinerary.preferences.join(', ')}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[#5B6B7B]">Tổng lộ trình</span>
                  <p className="text-base font-bold text-[#0F9D8F] tabular-nums">
                    {generatedItinerary.days.length} Ngày khám phá
                  </p>
                </div>
              </div>

              {/* TIMELINE CHI TIẾT TỪNG NGÀY */}
              <div className="space-y-6">
                {generatedItinerary.days.map((dayItem) => (
                  <div key={dayItem.day} className="border border-[#D5E3E3] rounded-2xl overflow-hidden bg-[#F7FAFA]">
                    
                    {/* Header ngày */}
                    <div className="px-4 py-3 bg-[#E8F4F3] border-b border-[#D5E3E3] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#0F9D8F] text-white flex items-center justify-center text-xs font-bold">
                          N{dayItem.day}
                        </span>
                        <h4 className="text-sm font-bold text-[#1F2D3D]">
                          {dayItem.title}
                        </h4>
                      </div>
                      <span className="text-[11px] text-[#0B5F57] font-semibold">
                        {dayItem.activities.length} hoạt động
                      </span>
                    </div>

                    {/* Timeline activities */}
                    <div className="p-4 space-y-3.5">
                      {dayItem.activities.map((act, actIdx) => (
                        <div key={actIdx} className="flex items-start gap-3 relative">
                          {/* Timeline vertical bar */}
                          {actIdx < dayItem.activities.length - 1 && (
                            <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-[#D5E3E3]"></div>
                          )}

                          {/* Time badge */}
                          <div className="w-12 shrink-0 py-1 px-1.5 rounded-lg bg-white border border-[#D5E3E3] text-center text-xs font-bold text-[#1F2D3D] tabular-nums">
                            {act.time}
                          </div>

                          {/* Activity content */}
                          <div className="flex-1 bg-white p-3 rounded-xl border border-[#D5E3E3] shadow-2xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h5 className="text-xs font-bold text-[#1F2D3D] flex items-center gap-1.5">
                                {act.type === 'food' ? (
                                  <Utensils className="w-3.5 h-3.5 text-[#FF8A5B]" />
                                ) : act.type === 'landmark' ? (
                                  <Landmark className="w-3.5 h-3.5 text-[#0F9D8F]" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-[#0F9D8F]" />
                                )}
                                <span>{act.title}</span>
                              </h5>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                act.type === 'food' 
                                  ? 'bg-amber-50 text-[#F5B83D] border border-amber-200' 
                                  : 'bg-[#E8F4F3] text-[#0F9D8F] border border-[#A8DCD5]'
                              }`}>
                                {act.type === 'food' ? 'Đặc sản ẩm thực' : 'Điểm đến'}
                              </span>
                            </div>
                            <p className="text-xs text-[#5B6B7B] leading-relaxed">
                              {act.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>

              {/* ACTION FOOTER THEO ĐÚNG SƠ ĐỒ HOẠT ĐỘNG:
                  Nhánh 1: Không ưng ý -> [ Nút: Tùy chỉnh lại ]
                  Nhánh 2: Ưng ý -> [ NÚT: LƯU VÀO SỔ TAY DU LỊCH ]
              */}
              <div className="pt-4 border-t border-[#D5E3E3] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-[#D5E3E3] bg-[#F7FAFA] hover:bg-[#E8F4F3] text-xs font-semibold text-[#5B6B7B] hover:text-[#1F2D3D] flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tùy chỉnh lại tùy chọn</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToNotebook}
                  className="px-6 py-2.5 rounded-xl bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Bookmark className="w-4 h-4 text-[#FF8A5B]" />
                  <span>LƯU VÀO SỔ TAY DU LỊCH (+40 Điểm)</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
