import React, { useState } from 'react';
import { TravelNotebookEntry, SavedItinerary, Badge, User } from '../types';
import { apiService } from '../services/apiService';
import { 
  BookMarked, 
  Heart, 
  CheckCircle2, 
  Award, 
  Calendar, 
  Trash2, 
  MapPin, 
  Sparkles, 
  Compass, 
  Trophy, 
  Utensils, 
  Mountain, 
  Camera, 
  Star,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface TravelNotebookModalProps {
  currentUser: User;
  onRefreshData: () => void;
  onSelectProvinceName?: (name: string) => void;
}

export const TravelNotebookModal: React.FC<TravelNotebookModalProps> = ({
  currentUser,
  onRefreshData,
  onSelectProvinceName
}) => {
  const [activeTab, setActiveTab] = useState<'places' | 'itineraries' | 'gamification'>('places');
  const [placeFilter, setPlaceFilter] = useState<'All' | 'Visited' | 'Wishlist'>('All');

  const notebook = apiService.getNotebook();
  const itineraries = apiService.getSavedItineraries();
  const badges = apiService.getBadges();
  const leaderboard = apiService.getLeaderboard();

  const filteredPlaces = notebook.filter(item => {
    if (placeFilter === 'All') return true;
    return item.status === placeFilter;
  });

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Compass': return <Compass className="w-5 h-5 text-[#0F9D8F]" />;
      case 'Utensils': return <Utensils className="w-5 h-5 text-[#FF8A5B]" />;
      case 'Camera': return <Camera className="w-5 h-5 text-[#0F9D8F]" />;
      case 'Mountain': return <Mountain className="w-5 h-5 text-[#0B5F57]" />;
      default: return <Award className="w-5 h-5 text-[#FF8A5B]" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Profile & Gamification Stats */}
      <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0F9D8F] to-[#0B5F57] text-white flex items-center justify-center font-black text-xl shadow-xs">
              {currentUser.username.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1F2D3D]">
                  {currentUser.username}
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#E8F4F3] text-[#0B5F57] border border-[#A8DCD5]">
                  {currentUser.title}
                </span>
              </div>
              <p className="text-xs text-[#5B6B7B] mt-0.5">
                {currentUser.email} · Tham gia khám phá du lịch Việt Nam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-[#F7FAFA] rounded-xl border border-[#D5E3E3]">
              <span className="text-[11px] text-[#5B6B7B] block">Tổng điểm</span>
              <span className="text-lg font-black text-[#0F9D8F] tabular-nums">
                {currentUser.total_points}
              </span>
            </div>

            <div className="text-center px-4 py-2 bg-[#F7FAFA] rounded-xl border border-[#D5E3E3]">
              <span className="text-[11px] text-[#5B6B7B] block">Tỉnh đã đi</span>
              <span className="text-lg font-black text-[#2E9E5B] tabular-nums">
                {currentUser.visited_provinces.length}
              </span>
            </div>

            <div className="text-center px-4 py-2 bg-[#F7FAFA] rounded-xl border border-[#D5E3E3]">
              <span className="text-[11px] text-[#5B6B7B] block">Huy hiệu</span>
              <span className="text-lg font-black text-[#FF8A5B] tabular-nums">
                {badges.filter(b => b.unlocked).length} / {badges.length}
              </span>
            </div>
          </div>
        </div>

        {/* Level Progress bar */}
        <div className="mt-5 pt-4 border-t border-[#D5E3E3]">
          <div className="flex items-center justify-between text-xs text-[#5B6B7B] mb-1.5">
            <span>Tiến độ thăng hạng: <strong className="text-[#1F2D3D]">{currentUser.title}</strong></span>
            <span className="tabular-nums font-semibold">{currentUser.total_points} / 500 điểm để đạt "Bậc thầy Xuyên Việt"</span>
          </div>
          <div className="w-full h-2.5 bg-[#E8F4F3] rounded-full overflow-hidden border border-[#D5E3E3]">
            <div
              className="h-full bg-gradient-to-r from-[#0F9D8F] to-[#2E9E5B] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (currentUser.total_points / 500) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#D5E3E3] pb-2">
        <button
          onClick={() => setActiveTab('places')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
            activeTab === 'places'
              ? 'bg-[#0F9D8F] text-white shadow-xs'
              : 'bg-white text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          <span>Điểm Đến & Món Ăn ({notebook.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('itineraries')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
            activeTab === 'itineraries'
              ? 'bg-[#0F9D8F] text-white shadow-xs'
              : 'bg-white text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Lịch Trình Đã Lưu ({itineraries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gamification')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
            activeTab === 'gamification'
              ? 'bg-[#0F9D8F] text-white shadow-xs'
              : 'bg-white text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
          }`}
        >
          <Trophy className="w-4 h-4 text-[#FF8A5B]" />
          <span>Huy Hiệu & Bảng Xếp Hạng</span>
        </button>
      </div>

      {/* TAB 1: ĐIỂM ĐẾN & MÓN ĂN */}
      {activeTab === 'places' && (
        <div className="space-y-4">
          
          {/* Subfilter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setPlaceFilter('All')}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  placeFilter === 'All'
                    ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0B5F57] font-bold'
                    : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                }`}
              >
                Tất cả ({notebook.length})
              </button>
              <button
                onClick={() => setPlaceFilter('Visited')}
                className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                  placeFilter === 'Visited'
                    ? 'border-[#2E9E5B] bg-[#2E9E5B]/10 text-[#2E9E5B] font-bold'
                    : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E5B]" />
                <span>Đã ghé thăm ({notebook.filter(n => n.status === 'Visited').length})</span>
              </button>
              <button
                onClick={() => setPlaceFilter('Wishlist')}
                className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                  placeFilter === 'Wishlist'
                    ? 'border-[#FF8A5B] bg-[#FF8A5B]/10 text-[#FF8A5B] font-bold'
                    : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-[#FF8A5B]" />
                <span>Muốn đi (Wishlist) ({notebook.filter(n => n.status === 'Wishlist').length})</span>
              </button>
            </div>
          </div>

          {filteredPlaces.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#D5E3E3] shadow-xs">
              <BookMarked className="w-10 h-10 text-[#5CC0B4] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-[#1F2D3D]">Chưa có mục nào trong danh sách</h4>
              <p className="text-xs text-[#5B6B7B] mt-1">
                Hãy khám phá bản đồ và bấm nút "Check-in" hoặc "Yêu thích" tại các điểm đến.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaces.map(entry => (
                <div
                  key={entry.notebook_id}
                  className="p-4 rounded-2xl bg-white border border-[#D5E3E3] shadow-xs hover:border-[#0F9D8F] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        entry.status === 'Visited'
                          ? 'bg-[#2E9E5B]/10 text-[#2E9E5B] border border-[#2E9E5B]/20'
                          : 'bg-[#FF8A5B]/10 text-[#FF8A5B] border border-[#FF8A5B]/20'
                      }`}>
                        {entry.status === 'Visited' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Đã đặt chân
                          </>
                        ) : (
                          <>
                            <Heart className="w-3 h-3" />
                            Danh sách yêu thích
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-[#5B6B7B] tabular-nums">
                        {entry.created_at}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#1F2D3D] mb-1">
                      {entry.item_name}
                    </h4>
                    <p className="text-xs text-[#5B6B7B] flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3 text-[#0F9D8F]" />
                      <span>{entry.province_name}</span>
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-[#1F2D3D] bg-[#F7FAFA] p-2.5 rounded-xl border border-[#D5E3E3] italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#D5E3E3] flex items-center justify-between text-xs">
                    <span className="text-[#0F9D8F] font-semibold">
                      {entry.category || 'Điểm đến'}
                    </span>
                    {onSelectProvinceName && (
                      <button
                        onClick={() => onSelectProvinceName(entry.province_name)}
                        className="text-xs font-semibold text-[#5B6B7B] hover:text-[#0F9D8F] flex items-center gap-1"
                      >
                        <span>Xem tỉnh</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: LỊCH TRÌNH ĐÃ LƯU */}
      {activeTab === 'itineraries' && (
        <div className="space-y-4">
          {itineraries.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#D5E3E3] shadow-xs">
              <Calendar className="w-10 h-10 text-[#5CC0B4] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-[#1F2D3D]">Chưa có lịch trình nào được lưu</h4>
              <p className="text-xs text-[#5B6B7B] mt-1">
                Hãy sử dụng tính năng Travel Planner để nhận gợi ý lộ trình và bấm "Lưu vào Sổ tay".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {itineraries.map((itinerary) => (
                <div
                  key={itinerary.id}
                  className="bg-white rounded-2xl p-5 border border-[#D5E3E3] shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D5E3E3]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#0B5F57] bg-[#E8F4F3] px-2 py-0.5 rounded-sm">
                        {itinerary.duration}
                      </span>
                      <h4 className="text-base font-bold text-[#1F2D3D] mt-1">
                        {itinerary.title}
                      </h4>
                      <p className="text-xs text-[#5B6B7B]">
                        Tạo ngày {itinerary.created_at} · Tuyến đường: {itinerary.provinces.join(' ➔ ')}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-[#0F9D8F] bg-[#E8F4F3] px-3 py-1.5 rounded-xl border border-[#A8DCD5]">
                      {itinerary.days.length} Ngày khám phá
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {itinerary.days.map(d => (
                      <div key={d.day} className="p-3 rounded-xl bg-[#F7FAFA] border border-[#D5E3E3]">
                        <p className="text-xs font-bold text-[#0F9D8F] mb-1.5">
                          {d.title}
                        </p>
                        <ul className="text-xs text-[#5B6B7B] space-y-1">
                          {d.activities.slice(0, 3).map((act, i) => (
                            <li key={i} className="truncate">
                              <span className="font-semibold text-[#1F2D3D]">{act.time}:</span> {act.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GAMIFICATION & BẢNG XẾP HẠNG */}
      {activeTab === 'gamification' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CỘT TRÁI: DANH MỤC HUY HIỆU (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-4">
            <div className="pb-3 border-b border-[#D5E3E3]">
              <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#FF8A5B]" />
                Danh Mục Huy Hiệu Hành Trình
              </h3>
              <p className="text-xs text-[#5B6B7B]">
                Mở khóa huy hiệu bằng cách check-in địa điểm, đánh giá UGC và hoàn thành lịch trình
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {badges.map(b => (
                <div
                  key={b.badge_id}
                  className={`p-4 rounded-2xl border transition-all ${
                    b.unlocked
                      ? 'bg-[#E8F4F3]/50 border-[#0F9D8F] shadow-xs'
                      : 'bg-[#F7FAFA] border-[#D5E3E3] opacity-65'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      b.unlocked ? 'bg-white border border-[#A8DCD5] shadow-xs' : 'bg-slate-200'
                    }`}>
                      {getBadgeIcon(b.icon)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-[#1F2D3D]">
                          {b.name}
                        </h4>
                        {b.unlocked && (
                          <span className="text-[10px] text-[#2E9E5B] font-bold">
                            ✓ Đã mở
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5B6B7B] mt-1 leading-snug">
                        {b.description}
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-bold text-[#0B5F57] bg-white px-2 py-0.5 rounded-md border border-[#D5E3E3] tabular-nums">
                        Yêu cầu: {b.required_points} điểm
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI: BẢNG XẾP HẠNG HÀNH TRÌNH (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-4">
            <div className="pb-3 border-b border-[#D5E3E3]">
              <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#F5B83D]" />
                Bảng Xếp Hạng Lữ Khách
              </h3>
              <p className="text-xs text-[#5B6B7B]">
                Cộng đồng phượt thủ và du khách có điểm số cao nhất
              </p>
            </div>

            <div className="space-y-2.5">
              {leaderboard.map(user => {
                const isMe = user.username === currentUser.username;
                return (
                  <div
                    key={user.rank}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isMe
                        ? 'bg-[#E8F4F3] border-[#0F9D8F] font-semibold'
                        : 'bg-[#F7FAFA] border-[#D5E3E3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                        user.rank === 1 ? 'bg-[#F5B83D] text-white' :
                        user.rank === 2 ? 'bg-slate-300 text-slate-800' :
                        user.rank === 3 ? 'bg-[#FF8A5B] text-white' :
                        'bg-slate-100 text-[#5B6B7B]'
                      }`}>
                        {user.rank}
                      </div>

                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200">
                        <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-[#1F2D3D] flex items-center gap-1">
                          {user.username}
                          {isMe && <span className="text-[10px] text-[#0F9D8F]">(Bạn)</span>}
                        </p>
                        <p className="text-[10px] text-[#5B6B7B]">
                          {user.title} · {user.visited_count} tỉnh
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-[#0B5F57] tabular-nums">
                        {user.total_points} đ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
