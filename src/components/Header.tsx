import React, { useState } from 'react';
import { Map, Calendar, BookMarked, ShieldCheck, Award, UserCheck, ChevronDown, Sparkles, FileCode } from 'lucide-react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface HeaderProps {
  currentTab: 'explore' | 'planner' | 'notebook' | 'admin' | 'architecture';
  onSelectTab: (tab: 'explore' | 'planner' | 'notebook' | 'admin' | 'architecture') => void;
  currentUser: User;
  onUserUpdate: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onUserUpdate
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleSwitchRole = (role: 'admin' | 'user' | 'guest') => {
    apiService.switchUserRole(role);
    setShowRoleMenu(false);
    onUserUpdate();
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#D5E3E3] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Zone 1: Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('explore')}
              className="flex items-center gap-2.5 text-left group transition-transform focus:outline-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F9D8F] to-[#0B5F57] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Map className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#1F2D3D] flex items-center gap-1.5">
                  Việt Nam Travel Map
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-sm bg-[#E8F4F3] text-[#0F9D8F] border border-[#A8DCD5]">
                    Interactive
                  </span>
                </span>
                <p className="text-xs text-[#5B6B7B] hidden sm:block">
                  Bản đồ nhiệt · Travel Planner · Sổ tay hành trình
                </p>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => onSelectTab('explore')}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                currentTab === 'explore'
                  ? 'bg-[#E8F4F3] text-[#0F9D8F] font-semibold'
                  : 'text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#F7FAFA]'
              }`}
            >
              <Map className="w-4 h-4 text-[#0F9D8F]" />
              <span>Khám phá & Bản đồ nhiệt</span>
            </button>

            <button
              onClick={() => onSelectTab('planner')}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                currentTab === 'planner'
                  ? 'bg-[#E8F4F3] text-[#0F9D8F] font-semibold'
                  : 'text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#F7FAFA]'
              }`}
            >
              <Calendar className="w-4 h-4 text-[#0F9D8F]" />
              <span>Lên lịch trình (Planner)</span>
            </button>

            <button
              onClick={() => onSelectTab('notebook')}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                currentTab === 'notebook'
                  ? 'bg-[#E8F4F3] text-[#0F9D8F] font-semibold'
                  : 'text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#F7FAFA]'
              }`}
            >
              <BookMarked className="w-4 h-4 text-[#0F9D8F]" />
              <span>Sổ tay & Gamification</span>
            </button>

            <button
              onClick={() => onSelectTab('architecture')}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                currentTab === 'architecture'
                  ? 'bg-[#E8F4F3] text-[#0F9D8F] font-semibold'
                  : 'text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#F7FAFA]'
              }`}
            >
              <FileCode className="w-4 h-4 text-[#5B6B7B]" />
              <span>Sơ đồ hệ thống</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  currentTab === 'admin'
                    ? 'bg-[#E8F4F3] text-[#0F9D8F] font-semibold'
                    : 'text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#F7FAFA]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#FF8A5B]" />
                <span className="flex items-center gap-1.5">
                  CMS Quản trị
                  <span className="w-2 h-2 rounded-full bg-[#FF8A5B] animate-pulse"></span>
                </span>
              </button>
            )}
          </nav>

          {/* Zone 3: User Profile & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Gamification Points Capsule */}
            {currentUser.role !== 'guest' && (
              <div 
                onClick={() => onSelectTab('notebook')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E8F4F3] border border-[#A8DCD5] cursor-pointer hover:bg-[#D5E3E3]/40 transition-colors"
                title="Điểm tích lũy hành trình du lịch của bạn"
              >
                <Award className="w-4 h-4 text-[#FF8A5B]" />
                <span className="text-xs font-bold text-[#0B5F57] tabular-nums">
                  {currentUser.total_points} điểm
                </span>
                <span className="text-[11px] text-[#5B6B7B] hidden lg:inline">
                  · {currentUser.visited_provinces.length} tỉnh đã đi
                </span>
              </div>
            )}

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-[#D5E3E3] bg-[#F7FAFA] hover:bg-[#E8F4F3] transition-colors focus:outline-hidden"
              >
                <div className="w-7 h-7 rounded-full bg-[#0F9D8F] text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : currentUser.role === 'guest' ? (
                    <UserCheck className="w-4 h-4" />
                  ) : (
                    currentUser.username.charAt(0)
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-[#1F2D3D] leading-tight flex items-center gap-1">
                    {currentUser.username}
                  </p>
                  <p className="text-[11px] text-[#5B6B7B] leading-tight">
                    {currentUser.role === 'admin' ? 'Quản trị viên (CMS)' : currentUser.role === 'guest' ? 'Khách vãng lai' : currentUser.title}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#5B6B7B]" />
              </button>

              {/* Role switcher menu */}
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-[#D5E3E3] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2 border-b border-[#D5E3E3]">
                    <p className="text-xs font-semibold text-[#1F2D3D]">Chuyển đổi tác nhân thử nghiệm</p>
                    <p className="text-[11px] text-[#5B6B7B]">Theo sơ đồ Use Case của đề tài</p>
                  </div>

                  <button
                    onClick={() => handleSwitchRole('user')}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-[#E8F4F3] transition-colors ${
                      currentUser.role === 'user' ? 'text-[#0F9D8F] font-bold bg-[#E8F4F3]/60' : 'text-[#1F2D3D]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">Khách du lịch (Đã đăng nhập)</p>
                      <p className="text-[11px] text-[#5B6B7B]">Dùng Sổ tay, Planner, UGC, Gamification</p>
                    </div>
                    {currentUser.role === 'user' && <span className="w-2 h-2 rounded-full bg-[#0F9D8F]"></span>}
                  </button>

                  <button
                    onClick={() => handleSwitchRole('admin')}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-[#E8F4F3] transition-colors ${
                      currentUser.role === 'admin' ? 'text-[#0F9D8F] font-bold bg-[#E8F4F3]/60' : 'text-[#1F2D3D]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-[#1F2D3D]">Quản trị viên (Admin CMS)</p>
                      <p className="text-[11px] text-[#5B6B7B]">Duyệt UGC review, quản lý tỉnh thành, CMS</p>
                    </div>
                    {currentUser.role === 'admin' && <span className="w-2 h-2 rounded-full bg-[#FF8A5B]"></span>}
                  </button>

                  <button
                    onClick={() => handleSwitchRole('guest')}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-[#E8F4F3] transition-colors ${
                      currentUser.role === 'guest' ? 'text-[#0F9D8F] font-bold bg-[#E8F4F3]/60' : 'text-[#1F2D3D]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">Khách vãng lai (Chưa đăng nhập)</p>
                      <p className="text-[11px] text-[#5B6B7B]">Tra cứu Heatmap, lọc thông tin tỉnh thành</p>
                    </div>
                    {currentUser.role === 'guest' && <span className="w-2 h-2 rounded-full bg-[#5B6B7B]"></span>}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Nav Toggle */}
            <div className="flex md:hidden">
              <button
                onClick={() => onSelectTab(currentTab === 'planner' ? 'explore' : 'planner')}
                className="p-2 rounded-lg bg-[#E8F4F3] text-[#0F9D8F]"
                title="Menu"
              >
                <Calendar className="w-5 h-5" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
