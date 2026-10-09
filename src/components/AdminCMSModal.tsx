import React, { useState } from 'react';
import { Province, Review } from '../types';
import { apiService } from '../services/apiService';
import { 
  ShieldCheck, 
  BarChart3, 
  Map, 
  CheckSquare, 
  Award, 
  Check, 
  X, 
  Eye, 
  Users, 
  Star, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  PlusCircle,
  Save,
  FileText
} from 'lucide-react';

interface AdminCMSModalProps {
  provinces: Province[];
  onRefreshData: () => void;
  onExitAdmin: () => void;
}

export const AdminCMSModal: React.FC<AdminCMSModalProps> = ({
  provinces,
  onRefreshData,
  onExitAdmin
}) => {
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'provinces' | 'reviews' | 'badges'>('reviews');
  const [reviewFilter, setReviewFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Edit Province state
  const [editingProvince, setEditingProvince] = useState<Province | null>(null);

  const stats = apiService.getCMSStats();
  const reviews = apiService.getReviews();

  const filteredReviews = reviews.filter(r => {
    if (reviewFilter === 'All') return true;
    return r.status === reviewFilter;
  });

  const handleModerate = (reviewId: number, status: 'Approved' | 'Rejected') => {
    apiService.moderateReview(reviewId, status);
    onRefreshData();
  };

  const handleSaveProvince = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProvince) {
      apiService.updateProvince(editingProvince);
      setEditingProvince(null);
      onRefreshData();
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#D5E3E3] shadow-md overflow-hidden min-h-[720px] flex flex-col">
      
      {/* Top Banner CMS Admin */}
      <div className="px-6 py-4 bg-[#1F2D3D] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F9D8F] flex items-center justify-center text-white font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              CMS Quản Trị Hệ Thống (Vietnam Travel Map Admin)
              <span className="text-[10px] font-semibold bg-[#FF8A5B] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                Admin Role
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Xin chào, Quản trị viên! Bảng điều khiển quản lý nội dung & quy trình kiểm duyệt UGC
            </p>
          </div>
        </div>

        <button
          onClick={onExitAdmin}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-xl transition-colors text-white"
        >
          Trở về giao diện người dùng
        </button>
      </div>

      {/* Main CMS Split Layout: Menu bên trái | Khu vực hiển thị Dashboard */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12">
        
        {/* MENU BÊN TRÁI (3 cols on desktop) */}
        <div className="md:col-span-3 bg-[#F7FAFA] border-r border-[#D5E3E3] p-4 space-y-1">
          <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5B6B7B]">
            Menu Quản Trị CMS
          </p>

          <button
            onClick={() => setActiveMenu('dashboard')}
            className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl text-left flex items-center gap-2.5 transition-colors ${
              activeMenu === 'dashboard'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'text-[#1F2D3D] hover:bg-[#E8F4F3]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Thống kê hệ thống</span>
          </button>

          <button
            onClick={() => setActiveMenu('provinces')}
            className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl text-left flex items-center gap-2.5 transition-colors ${
              activeMenu === 'provinces'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'text-[#1F2D3D] hover:bg-[#E8F4F3]'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Quản lý Tỉnh / Thành ({provinces.length})</span>
          </button>

          <button
            onClick={() => setActiveMenu('reviews')}
            className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl text-left flex items-center justify-between transition-colors ${
              activeMenu === 'reviews'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'text-[#1F2D3D] hover:bg-[#E8F4F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className="w-4 h-4" />
              <span>KIỂM DUYỆT REVIEW (UGC)</span>
            </div>
            {stats.pendingReviews > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#FF8A5B] text-white text-[10px] font-bold flex items-center justify-center">
                {stats.pendingReviews}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMenu('badges')}
            className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl text-left flex items-center gap-2.5 transition-colors ${
              activeMenu === 'badges'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'text-[#1F2D3D] hover:bg-[#E8F4F3]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Quản lý Huy hiệu & Điểm</span>
          </button>

          {/* Workflow Note */}
          <div className="mt-8 p-3 rounded-xl bg-white border border-[#D5E3E3] text-[11px] text-[#5B6B7B] space-y-1">
            <p className="font-bold text-[#1F2D3D] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#0F9D8F]" />
              Quy trình UGC:
            </p>
            <p>
              Khách gửi Review ➔ Bảng Reviews ghi nhận trạng thái <strong>Pending</strong> ➔ Admin bấm [Xanh: Duyệt] hoặc [Đỏ: Từ chối].
            </p>
          </div>
        </div>

        {/* KHU VỰC HIỂN THỊ DASHBOARD (9 cols on desktop) */}
        <div className="md:col-span-9 p-6 space-y-6 overflow-y-auto">
          
          {/* Top Quick Stats Banner (Always Visible on CMS) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3]">
              <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                <span>TỔNG SỐ USER</span>
                <Users className="w-4 h-4 text-[#0F9D8F]" />
              </div>
              <p className="text-xl font-black text-[#1F2D3D] tabular-nums">
                {stats.totalUsers.toLocaleString('vi-VN')}
              </p>
              <span className="text-[10px] text-[#2E9E5B] font-semibold">
                ● 100% tài khoản hoạt động
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3]">
              <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                <span>REVIEW ĐANG CHỜ</span>
                <Clock className="w-4 h-4 text-[#F5B83D]" />
              </div>
              <p className="text-xl font-black text-[#F5B83D] tabular-nums">
                {stats.pendingReviews} bài
              </p>
              <span className="text-[10px] text-[#F5B83D] font-semibold">
                Cần kiểm duyệt ngay
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3]">
              <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                <span>TỔNG TỈNH / THÀNH</span>
                <Map className="w-4 h-4 text-[#0F9D8F]" />
              </div>
              <p className="text-xl font-black text-[#0B5F57] tabular-nums">
                {stats.totalProvinces} địa phương
              </p>
              <span className="text-[10px] text-[#5B6B7B]">
                {stats.totalLocations} điểm đến POI
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3]">
              <div className="flex items-center justify-between text-[#5B6B7B] text-xs mb-1">
                <span>TỶ LỆ DUYỆT BÀI</span>
                <CheckCircle2 className="w-4 h-4 text-[#2E9E5B]" />
              </div>
              <p className="text-xl font-black text-[#2E9E5B] tabular-nums">
                {stats.approvalRate}%
              </p>
              <span className="text-[10px] text-[#5B6B7B]">
                {stats.approvedReviews} bài đã xuất bản
              </span>
            </div>

          </div>

          {/* VIEW 1: KIỂM DUYỆT REVIEW (UGC WORKFLOW) */}
          {activeMenu === 'reviews' && (
            <div className="space-y-4">
              
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D5E3E3]">
                <div>
                  <h3 className="text-base font-bold text-[#1F2D3D]">
                    DANH SÁCH REVIEW CHỜ DUYỆT & ĐÃ XỬ LÝ (UGC Workflow)
                  </h3>
                  <p className="text-xs text-[#5B6B7B]">
                    Xem xét nội dung bài đánh giá, hình ảnh đính kèm trước khi cho phép xuất bản lên bản đồ
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setReviewFilter('Pending')}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                      reviewFilter === 'Pending'
                        ? 'border-[#F5B83D] bg-amber-50 text-[#F5B83D]'
                        : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                    }`}
                  >
                    Chờ duyệt ({reviews.filter(r => r.status === 'Pending').length})
                  </button>
                  <button
                    onClick={() => setReviewFilter('Approved')}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                      reviewFilter === 'Approved'
                        ? 'border-[#2E9E5B] bg-emerald-50 text-[#2E9E5B]'
                        : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                    }`}
                  >
                    Đã duyệt ({reviews.filter(r => r.status === 'Approved').length})
                  </button>
                  <button
                    onClick={() => setReviewFilter('All')}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                      reviewFilter === 'All'
                        ? 'border-[#0F9D8F] bg-[#E8F4F3] text-[#0F9D8F]'
                        : 'border-[#D5E3E3] bg-white text-[#5B6B7B]'
                    }`}
                  >
                    Tất cả ({reviews.length})
                  </button>
                </div>
              </div>

              {filteredReviews.length === 0 ? (
                <div className="p-12 text-center bg-[#F7FAFA] rounded-2xl border border-[#D5E3E3]">
                  <CheckCircle2 className="w-10 h-10 text-[#2E9E5B] mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#1F2D3D]">Không có review nào thuộc trạng thái này</p>
                  <p className="text-xs text-[#5B6B7B] mt-1">Toàn bộ nội dung UGC đã được xử lý xong!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReviews.map((rev, index) => (
                    <div
                      key={rev.review_id}
                      className="p-4 rounded-2xl border border-[#D5E3E3] bg-[#F7FAFA] hover:bg-white transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-[#0F9D8F] text-white flex items-center justify-center text-xs font-bold tabular-nums">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-[#1F2D3D]">
                              {rev.username} · Đánh giá: <strong className="text-[#0F9D8F]">{rev.location_name}</strong>
                            </p>
                            <p className="text-[11px] text-[#5B6B7B]">
                              Khu vực: {rev.province_name} · Gửi lúc: {rev.created_at}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                            rev.status === 'Pending'
                              ? 'bg-amber-100 text-[#F5B83D] border border-amber-300'
                              : rev.status === 'Approved'
                              ? 'bg-emerald-100 text-[#2E9E5B] border border-emerald-300'
                              : 'bg-red-100 text-[#E5484D] border border-red-300'
                          }`}>
                            {rev.status === 'Pending' ? 'Chờ kiểm duyệt' : rev.status === 'Approved' ? 'Đã duyệt' : 'Từ chối'}
                          </span>

                          <div className="flex items-center gap-1 text-xs font-bold text-[#FF8A5B]">
                            <Star className="w-3.5 h-3.5 fill-[#FF8A5B]" />
                            <span>{rev.rating_star}★</span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-[#1F2D3D] bg-white p-3 rounded-xl border border-[#D5E3E3] leading-relaxed">
                        "{rev.content}"
                      </p>

                      {/* Action Bar with Exact Buttons: [ XANH: Duyệt ] [ ĐỎ: Từ chối ] [ Nút: Xem ảnh ] */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D5E3E3]/60">
                        {rev.image_url ? (
                          <button
                            type="button"
                            onClick={() => setViewingImage(rev.image_url || null)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#D5E3E3] hover:border-[#0F9D8F] text-[#0F9D8F] flex items-center gap-1.5 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>[ Nút: Xem ảnh đính kèm ]</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#5B6B7B] italic">Không đính kèm ảnh</span>
                        )}

                        <div className="flex items-center gap-2">
                          {/* NÚT ĐỎ: TỪ CHỐI */}
                          <button
                            type="button"
                            onClick={() => handleModerate(rev.review_id, 'Rejected')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                              rev.status === 'Rejected'
                                ? 'bg-[#E5484D] text-white opacity-80'
                                : 'bg-red-50 hover:bg-[#E5484D] text-[#E5484D] hover:text-white border border-red-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>[ ĐỎ: Từ chối ]</span>
                          </button>

                          {/* NÚT XANH: DUYỆT */}
                          <button
                            type="button"
                            onClick={() => handleModerate(rev.review_id, 'Approved')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                              rev.status === 'Approved'
                                ? 'bg-[#2E9E5B] text-white opacity-90'
                                : 'bg-[#2E9E5B] hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>[ XANH: Duyệt bài ]</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* VIEW 2: QUẢN LÝ TỈNH / THÀNH */}
          {activeMenu === 'provinces' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5E3E3]">
                <div>
                  <h3 className="text-base font-bold text-[#1F2D3D]">
                    Quản Lý Dữ Liệu Tỉnh / Thành & Chỉ Số Heatmap
                  </h3>
                  <p className="text-xs text-[#5B6B7B]">
                    Cập nhật các chỉ số GDP, Dân số, Mật độ khách và thông tin 5 Tabs
                  </p>
                </div>
              </div>

              {editingProvince ? (
                /* Form Chỉnh sửa */
                <form onSubmit={handleSaveProvince} className="p-5 rounded-2xl border border-[#0F9D8F] bg-[#F7FAFA] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D5E3E3]">
                    <h4 className="text-sm font-bold text-[#0F9D8F]">
                      Chỉnh sửa thông tin: {editingProvince.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingProvince(null)}
                      className="text-xs text-[#5B6B7B] hover:text-[#1F2D3D]"
                    >
                      Hủy bỏ
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-[#1F2D3D] mb-1">Mật độ khách du lịch (0-100)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingProvince.tourist_density}
                        onChange={e => setEditingProvince({ ...editingProvince, tourist_density: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 bg-white border border-[#D5E3E3] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1F2D3D] mb-1">Chỉ số GDP (Tỷ VNĐ)</label>
                      <input
                        type="number"
                        value={editingProvince.gdp}
                        onChange={e => setEditingProvince({ ...editingProvince, gdp: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 bg-white border border-[#D5E3E3] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1F2D3D] mb-1">Quy mô dân số</label>
                      <input
                        type="number"
                        value={editingProvince.population}
                        onChange={e => setEditingProvince({ ...editingProvince, population: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 bg-white border border-[#D5E3E3] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="text-xs space-y-2">
                    <div>
                      <label className="block font-bold text-[#1F2D3D] mb-1">Món ăn đặc sản tiêu biểu</label>
                      <input
                        type="text"
                        value={editingProvince.specialty_dish}
                        onChange={e => setEditingProvince({ ...editingProvince, specialty_dish: e.target.value })}
                        className="w-full p-2 bg-white border border-[#D5E3E3] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1F2D3D] mb-1">Danh lam thắng cảnh tiêu biểu</label>
                      <input
                        type="text"
                        value={editingProvince.top_landmark}
                        onChange={e => setEditingProvince({ ...editingProvince, top_landmark: e.target.value })}
                        className="w-full p-2 bg-white border border-[#D5E3E3] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#D5E3E3]">
                    <button
                      type="button"
                      onClick={() => setEditingProvince(null)}
                      className="px-3.5 py-2 text-xs font-semibold text-[#5B6B7B]"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#0F9D8F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Bảng danh sách Tỉnh */
                <div className="border border-[#D5E3E3] rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#E8F4F3] text-[#1F2D3D] font-bold border-b border-[#D5E3E3]">
                      <tr>
                        <th className="p-3">Tỉnh / Thành</th>
                        <th className="p-3">Khu vực</th>
                        <th className="p-3">Mật độ khách</th>
                        <th className="p-3">GDP (Tỷ VNĐ)</th>
                        <th className="p-3">Dân số</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D5E3E3]">
                      {provinces.map(p => (
                        <tr key={p.province_id} className="hover:bg-[#F7FAFA]">
                          <td className="p-3 font-bold text-[#1F2D3D]">{p.name}</td>
                          <td className="p-3 text-[#5B6B7B]">
                            {p.region === 'Bac' ? 'Miền Bắc' : p.region === 'Trung' ? 'Miền Trung' : p.region === 'Nam' ? 'Miền Nam' : 'Tây Nguyên'}
                          </td>
                          <td className="p-3 tabular-nums font-semibold text-[#0F9D8F]">{p.tourist_density}/100</td>
                          <td className="p-3 tabular-nums text-[#1F2D3D]">{p.gdp.toLocaleString('vi-VN')}</td>
                          <td className="p-3 tabular-nums text-[#5B6B7B]">{(p.population / 1000000).toFixed(2)}M</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setEditingProvince(p)}
                              className="px-2.5 py-1 bg-[#E8F4F3] text-[#0F9D8F] font-bold rounded-lg hover:bg-[#D5E3E3] transition-colors"
                            >
                              Sửa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* VIEW 3: THỐNG KÊ HỆ THỐNG */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#1F2D3D]">
                Báo Cáo Hoạt Động & Chỉ Số Tương Tác
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-3">
                  <h4 className="text-xs font-bold text-[#1F2D3D] uppercase tracking-wider">
                    Phân bố Tỉnh Thành theo Miền
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Miền Bắc</span>
                      <span className="font-bold tabular-nums">
                        {provinces.filter(p => p.region === 'Bac').length} tỉnh (Hà Nội, Quảng Ninh...)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Miền Trung</span>
                      <span className="font-bold tabular-nums">
                        {provinces.filter(p => p.region === 'Trung').length} tỉnh (Đà Nẵng, Huế, Nha Trang...)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tây Nguyên</span>
                      <span className="font-bold tabular-nums">
                        {provinces.filter(p => p.region === 'TayNguyen').length} tỉnh (Lâm Đồng - Đà Lạt...)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Miền Nam & ĐBSCL</span>
                      <span className="font-bold tabular-nums">
                        {provinces.filter(p => p.region === 'Nam').length} tỉnh (TP.HCM, Cần Thơ, Phú Quốc...)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-3">
                  <h4 className="text-xs font-bold text-[#1F2D3D] uppercase tracking-wider">
                    Hiệu Suất Kiểm Duyệt UGC
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Tổng bài viết UGC:</span>
                      <span className="font-bold tabular-nums">{stats.totalReviews} bài</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Đã duyệt xuất bản:</span>
                      <span className="font-bold text-[#2E9E5B] tabular-nums">{stats.approvedReviews} bài</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Đang chờ duyệt:</span>
                      <span className="font-bold text-[#F5B83D] tabular-nums">{stats.pendingReviews} bài</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: QUẢN LÝ HUY HIỆU */}
          {activeMenu === 'badges' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#1F2D3D]">
                Quản Lý Hệ Thống Huy Hiệu & Điểm Gamification
              </h3>
              <p className="text-xs text-[#5B6B7B]">
                Cấu hình điểm số kích hoạt các thành tựu trên hệ thống
              </p>
              
              <div className="border border-[#D5E3E3] rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#E8F4F3] text-[#1F2D3D] font-bold border-b border-[#D5E3E3]">
                    <tr>
                      <th className="p-3">Tên Huy hiệu</th>
                      <th className="p-3">Danh mục</th>
                      <th className="p-3">Điểm yêu cầu</th>
                      <th className="p-3">Điều kiện đạt được</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E3E3]">
                    {apiService.getBadges().map(b => (
                      <tr key={b.badge_id}>
                        <td className="p-3 font-bold text-[#1F2D3D]">{b.name}</td>
                        <td className="p-3 text-[#5B6B7B]">{b.category}</td>
                        <td className="p-3 tabular-nums font-bold text-[#0F9D8F]">{b.required_points} điểm</td>
                        <td className="p-3 text-[#5B6B7B]">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Image Modal Lightbox */}
      {viewingImage && (
        <div 
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="relative max-w-xl max-h-[85vh] rounded-2xl overflow-hidden bg-black">
            <img src={viewingImage} alt="Enlarged" className="w-full h-auto object-contain" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
