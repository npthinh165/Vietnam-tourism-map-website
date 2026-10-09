import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VietnamMap } from './components/VietnamMap';
import { ProvinceDetailModal } from './components/ProvinceDetailModal';
import { TravelPlanner } from './components/TravelPlanner';
import { TravelNotebookModal } from './components/TravelNotebookModal';
import { ReviewModal } from './components/ReviewModal';
import { LocationReviewsModal } from './components/LocationReviewsModal';
import { AdminCMSModal } from './components/AdminCMSModal';
import { ArchitectureView } from './components/ArchitectureView';
import { Province, LocationItem, User } from './types';
import { apiService } from './services/apiService';
import { Map, Calendar, BookMarked, ShieldCheck, Heart, Sparkles, Award } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<'explore' | 'planner' | 'notebook' | 'admin' | 'architecture'>('explore');
  const [currentUser, setCurrentUser] = useState<User>(apiService.getCurrentUser());
  const [provinces, setProvinces] = useState<Province[]>(apiService.getProvinces());

  // Modal states
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [focusedLocation, setFocusedLocation] = useState<LocationItem | null>(null);
  const [reviewTargetLocation, setReviewTargetLocation] = useState<LocationItem | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [inspectLocationReviews, setInspectLocationReviews] = useState<LocationItem | null>(null);

  // Sync data
  const refreshData = () => {
    setCurrentUser(apiService.getCurrentUser());
    setProvinces(apiService.getProvinces());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSelectProvince = (prov: Province) => {
    setSelectedProvince(prov);
  };

  const handleToggleProvinceVisited = (provId: number) => {
    apiService.markProvinceVisited(provId);
    refreshData();
  };

  const handleOpenReviewModal = (location?: LocationItem) => {
    setReviewTargetLocation(location || null);
    setShowReviewModal(true);
  };

  const handleOpenLocationReviews = (loc: LocationItem) => {
    setInspectLocationReviews(loc);
  };

  const handleSelectProvinceByName = (name: string) => {
    const p = provinces.find(prov => prov.name === name);
    if (p) {
      setSelectedProvince(p);
      setCurrentTab('explore');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFA] text-[#1F2D3D] flex flex-col font-sans selection:bg-[#E8F4F3] selection:text-[#0B5F57]">
      
      {/* 1. Header Navigation & Role Switcher */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        onUserUpdate={refreshData}
      />

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TAB 1: KHÁM PHÁ & BẢN ĐỒ NHIỆT (MÀN HÌNH 1) */}
        {currentTab === 'explore' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Hero Banner with Generated Landscape Photography */}
            <div className="relative rounded-3xl overflow-hidden shadow-xs border border-[#D5E3E3] bg-[#1F2D3D] text-white">
              <div className="absolute inset-0">
                <img
                  src="/src/assets/images/vietnam_travel_hero_1791335147966.jpg"
                  alt="Vịnh Hạ Long & Non Nước Việt Nam"
                  className="w-full h-full object-cover opacity-35"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1F2D3D] via-[#1F2D3D]/80 to-transparent" />
              </div>

              <div className="relative p-6 sm:p-8 max-w-2xl space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0F9D8F] text-white shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Nền Tảng Tương Tác Du Lịch Đa Chiều
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  Khám Phá Bản Đồ Du Lịch Việt Nam
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Trực quan hóa dữ liệu qua bản đồ nhiệt Heatmap (mật độ khách, GDP, dân số), tra cứu thông tin địa phương 5 chiều (Lịch sử, Địa lý, Đặc sản, Lễ hội, Danh thắng) và tạo lịch trình tự động tối ưu.
                </p>

                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={() => setCurrentTab('planner')}
                    className="px-4 py-2.5 bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Lên lịch trình tự động ngay</span>
                  </button>
                  <button
                    onClick={() => setCurrentTab('notebook')}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 flex items-center gap-2 transition-colors"
                  >
                    <BookMarked className="w-4 h-4 text-[#A8DCD5]" />
                    <span>Sổ tay của bạn ({currentUser.visited_provinces.length} tỉnh đã đi)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MÀN HÌNH 1: BẢN ĐỒ NHIỆT & BỘ LỌC THÔNG MINH */}
            <VietnamMap
              provinces={provinces}
              onSelectProvince={handleSelectProvince}
              selectedProvinceId={selectedProvince?.province_id}
              visitedProvinceIds={currentUser.visited_provinces}
              focusedLocation={focusedLocation}
            />
          </div>
        )}

        {/* TAB 2: LÊN LỊCH TRÌNH TRAVEL PLANNER (MÀN HÌNH 3) */}
        {currentTab === 'planner' && (
          <div className="animate-in fade-in duration-150">
            <TravelPlanner
              provinces={provinces}
              onSavedToNotebook={refreshData}
              onOpenNotebook={() => setCurrentTab('notebook')}
            />
          </div>
        )}

        {/* TAB 3: SỔ TAY HÀNH TRÌNH & GAMIFICATION */}
        {currentTab === 'notebook' && (
          <div className="animate-in fade-in duration-150">
            <TravelNotebookModal
              currentUser={currentUser}
              onRefreshData={refreshData}
              onSelectProvinceName={handleSelectProvinceByName}
            />
          </div>
        )}

        {/* TAB 4: CMS ADMIN (MÀN HÌNH 4) */}
        {currentTab === 'admin' && (
          <div className="animate-in fade-in duration-150">
            <AdminCMSModal
              provinces={provinces}
              onRefreshData={refreshData}
              onExitAdmin={() => setCurrentTab('explore')}
            />
          </div>
        )}

        {/* TAB 5: KIẾN TRÚC HỆ THỐNG & SƠ ĐỒ USECASE / HOẠT ĐỘNG */}
        {currentTab === 'architecture' && (
          <div className="animate-in fade-in duration-150">
            <ArchitectureView />
          </div>
        )}

      </main>

      {/* 3. MODAL CHI TIẾT TỈNH THÀNH (MÀN HÌNH 2: TRẢI NGHIỆM ĐA CHIỀU) */}
      {selectedProvince && (
        <ProvinceDetailModal
          province={selectedProvince}
          onClose={() => setSelectedProvince(null)}
          onOpenReviewModal={handleOpenReviewModal}
          onOpenLocationReviews={handleOpenLocationReviews}
          isProvinceVisited={currentUser.visited_provinces.includes(selectedProvince.province_id)}
          onToggleProvinceVisited={handleToggleProvinceVisited}
          onRefreshData={refreshData}
          onSelectLocationCard={(loc) => setFocusedLocation(loc)}
        />
      )}

      {/* 4. MODAL ĐĂNG REVIEW UGC (UGC WORKFLOW) */}
      {showReviewModal && (
        <ReviewModal
          location={reviewTargetLocation}
          province={selectedProvince}
          onClose={() => {
            setShowReviewModal(false);
            setReviewTargetLocation(null);
          }}
          onSuccess={refreshData}
        />
      )}

      {/* 5. MODAL XEM CÁC BÀI REVIEW ĐÃ DUYỆT CỦA ĐỊA ĐIỂM */}
      {inspectLocationReviews && (
        <LocationReviewsModal
          location={inspectLocationReviews}
          onClose={() => setInspectLocationReviews(null)}
          onOpenAddReview={() => {
            setReviewTargetLocation(inspectLocationReviews);
            setShowReviewModal(true);
          }}
        />
      )}

      {/* 6. Footer */}
      <footer className="bg-white border-t border-[#D5E3E3] py-6 text-xs text-[#5B6B7B] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0F9D8F] text-white flex items-center justify-center font-bold text-xs">
              V
            </div>
            <span className="font-bold text-[#1F2D3D]">
              Bản đồ Du lịch Việt Nam · Vietnam Travel Map Platform
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Khẳng định chủ quyền: Hoàng Sa & Trường Sa là của Việt Nam</span>
            <span>·</span>
            <span>React + Vite · Node.js Core Logic · MySQL Spatial Ready</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
