import React, { useState } from 'react';
import { 
  FileCode, 
  Database, 
  Server, 
  Layout, 
  Workflow, 
  CheckCircle2, 
  ExternalLink,
  Code2,
  Copy,
  Check
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'usecase' | 'architecture' | 'activity' | 'database' | 'sequence'>('usecase');
  const [copiedSQL, setCopiedSQL] = useState(false);

  const SQL_SCHEMA = `-- CƠ SỞ DỮ LIỆU: VietnamTravelMap (MySQL 8.0+)
CREATE DATABASE IF NOT EXISTS VietnamTravelMap;
USE VietnamTravelMap;

-- 1. Bảng Users (Người dùng & Admin)
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    total_points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Provinces (Dữ liệu Tỉnh/Thành & Heatmap)
CREATE TABLE Provinces (
    province_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gdp DECIMAL(15, 2) COMMENT 'Chỉ số GDP phục vụ Heatmap',
    population INT COMMENT 'Quy mô dân số',
    tourist_density DECIMAL(10, 2) COMMENT 'Mật độ du khách',
    geo_polygon JSON COMMENT 'Lưu tọa độ ranh giới vẽ bản đồ'
);

-- 3. Bảng Locations (Địa điểm, Đặc sản, Lễ hội...)
CREATE TABLE Locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    province_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category ENUM('History', 'Geography', 'Food', 'Festival', 'Landmark') NOT NULL,
    season ENUM('Spring', 'Summer', 'Autumn', 'Winter', 'AllYear') DEFAULT 'AllYear',
    description TEXT,
    lat DECIMAL(10, 8) COMMENT 'Vĩ độ',
    lng DECIMAL(11, 8) COMMENT 'Kinh độ',
    FOREIGN KEY (province_id) REFERENCES Provinces(province_id) ON DELETE CASCADE
);

-- 4. Bảng Travel_Notebooks (Sổ tay lưu trữ của người dùng)
CREATE TABLE Travel_Notebooks (
    notebook_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    location_id INT NOT NULL,
    status ENUM('Visited', 'Wishlist') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE
);

-- 5. Bảng Reviews (Hệ thống UGC - Người dùng đóng góp)
CREATE TABLE Reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    location_id INT NOT NULL,
    rating_star INT CHECK (rating_star >= 1 AND rating_star <= 5),
    content TEXT,
    image_url VARCHAR(500),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES Locations(location_id) ON DELETE CASCADE
);

-- 6. Bảng Badges (Danh mục Huy hiệu)
CREATE TABLE Badges (
    badge_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    required_points INT NOT NULL,
    icon_url VARCHAR(500)
);

-- 7. Bảng User_Badges (Thành tựu người dùng đạt được)
CREATE TABLE User_Badges (
    user_id INT NOT NULL,
    badge_id INT NOT NULL,
    achieved_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES Badges(badge_id) ON DELETE CASCADE
);`;

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0F9D8F] bg-[#E8F4F3] px-2.5 py-1 rounded-md border border-[#A8DCD5]">
          Kỹ Nghệ Phần Mềm (KTPMUD) · Thiết Kế Hệ Thống
        </span>
        <h1 className="text-2xl font-black text-[#1F2D3D] mt-2 tracking-tight">
          Sơ Đồ Kỹ Thuật & Kiến Trúc Hệ Thống Website Bản Đồ Du Lịch Việt Nam
        </h1>
        <p className="text-xs text-[#5B6B7B] mt-1 max-w-3xl">
          Tài liệu phân tích yêu cầu, sơ đồ ca sử dụng (Use Case), kiến trúc đa tầng (Frontend - API Gateway - Backend Logic - Core DB), sơ đồ hoạt động (Activity) và thiết kế cơ sở dữ liệu quan hệ MySQL theo đặc tả dự án.
        </p>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[#D5E3E3]">
          <button
            onClick={() => setActiveTab('usecase')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
              activeTab === 'usecase'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>1. Sơ đồ Use Case (Actors & Ca sử dụng)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
              activeTab === 'architecture'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>2. Kiến trúc Hệ thống 3 Lớp</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>3. Sơ đồ Hoạt động (Activity Flow)</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
              activeTab === 'database'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>4. Thiết kế Database MySQL & SQL Script</span>
          </button>

          <button
            onClick={() => setActiveTab('sequence')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
              activeTab === 'sequence'
                ? 'bg-[#0F9D8F] text-white shadow-xs'
                : 'bg-[#F7FAFA] text-[#5B6B7B] hover:text-[#1F2D3D] border border-[#D5E3E3]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>5. Sơ đồ Tuần tự (Sequence Diagram)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SƠ ĐỒ USE CASE */}
      {activeTab === 'usecase' && (
        <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D5E3E3]">
            <div>
              <h3 className="text-base font-bold text-[#1F2D3D]">
                Sơ Đồ Ca Sử Dụng (Use Case Diagram)
              </h3>
              <p className="text-xs text-[#5B6B7B]">
                Phân rã chức năng theo 2 nhóm tác nhân: Khách du lịch (Khách vãng lai & Đã đăng nhập) và Quản trị viên (Admin)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Tác nhân 1: Khách vãng lai */}
            <div className="p-4 rounded-2xl border border-[#D5E3E3] bg-[#F7FAFA] space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#5CC0B4] text-white flex items-center justify-center font-bold text-xs">
                  A1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1F2D3D]">Khách Vãng Lai</h4>
                  <p className="text-[10px] text-[#5B6B7B]">Chưa cần đăng nhập tài khoản</p>
                </div>
              </div>
              <ul className="text-xs space-y-2 text-[#1F2D3D]">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC1. Khám phá tỉnh/thành:</strong> Xem thông tin đa chiều 5 tabs (Lịch sử, Địa lý, Đặc sản, Lễ hội, Danh thắng).</span>
                </li>
                <li className="flex items-start gap-1.5 ml-3">
                  <span className="text-[#0F9D8F] font-bold">«extend»</span>
                  <span><strong>UC1.1 Lọc dữ liệu thông minh:</strong> Lọc theo mùa và theo loại hình du lịch.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC2. Xem bản đồ nhiệt (Heatmap):</strong> Mật độ khách, GDP, quy mô dân số.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC3. Đăng ký / Đăng nhập:</strong> Bắt buộc để sử dụng tính năng cá nhân hóa.</span>
                </li>
              </ul>
            </div>

            {/* Tác nhân 2: Khách đã đăng nhập */}
            <div className="p-4 rounded-2xl border border-[#0F9D8F] bg-[#E8F4F3]/40 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0F9D8F] text-white flex items-center justify-center font-bold text-xs">
                  A2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1F2D3D]">Khách Đã Đăng Nhập</h4>
                  <p className="text-[10px] text-[#0F9D8F] font-semibold">Tất cả có quan hệ «include» với UC3</p>
                </div>
              </div>
              <ul className="text-xs space-y-2 text-[#1F2D3D]">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC4. Quản lý Sổ tay du lịch:</strong> Đánh dấu điểm đã đi qua (Visited) và lưu danh sách yêu thích (Wishlist).</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC5. Tạo lịch trình tự động (Travel Planner):</strong> Nhận đề xuất lộ trình tối ưu và gợi ý món ăn.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC6. Tương tác Cộng đồng (UGC):</strong> Đăng tải Review, hình ảnh thực tế và bình chọn sao.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8F] shrink-0 mt-0.5" />
                  <span><strong>UC7. Quản lý thành tựu:</strong> Xem huy hiệu Gamification và theo dõi bảng xếp hạng hành trình.</span>
                </li>
              </ul>
            </div>

            {/* Tác nhân 3: Quản trị viên Admin */}
            <div className="p-4 rounded-2xl border border-[#FF8A5B] bg-[#FFF5F2] space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF8A5B] text-white flex items-center justify-center font-bold text-xs">
                  A3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1F2D3D]">Quản Trị Viên (Web Admin)</h4>
                  <p className="text-[10px] text-[#FF8A5B] font-semibold">Vận hành Web CMS Quản trị</p>
                </div>
              </div>
              <ul className="text-xs space-y-2 text-[#1F2D3D]">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF8A5B] shrink-0 mt-0.5" />
                  <span><strong>UC8. Quản lý dữ liệu Tỉnh/Thành:</strong> Thêm, sửa, xóa thông tin gốc về lịch sử, địa lý, đặc sản, chỉ số heatmap.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF8A5B] shrink-0 mt-0.5" />
                  <span><strong>UC9. Kiểm duyệt nội dung (UGC Workflow):</strong> Xem xét, duyệt (Approved) hoặc từ chối (Rejected) bài đánh giá và hình ảnh.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF8A5B] shrink-0 mt-0.5" />
                  <span><strong>UC10. Xem Dashboard thống kê:</strong> Theo dõi số liệu toàn hệ thống qua Trang quản trị CMS.</span>
                </li>
              </ul>
            </div>

          </div>

          <div className="p-4 rounded-xl bg-[#F7FAFA] border border-[#D5E3E3] text-xs text-[#5B6B7B] space-y-1">
            <p className="font-bold text-[#1F2D3D]">💡 Ghi chú kỹ nghệ phần mềm:</p>
            <p>• <strong>«include» (Bao hàm):</strong> Mũi tên từ UC4, UC5, UC6 trỏ về UC3 (Đăng nhập) - Bắt buộc xác thực trước khi ghi vào CSDL cá nhân.</p>
            <p>• <strong>«extend» (Mở rộng):</strong> Mũi tên từ UC1.1 trỏ về UC1 - Bộ lọc là tính năng mở rộng khi người dùng có nhu cầu lọc nâng cao.</p>
          </div>
        </div>
      )}

      {/* TAB 2: KIẾN TRÚC HỆ THỐNG */}
      {activeTab === 'architecture' && (
        <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#D5E3E3]">
            <h3 className="text-base font-bold text-[#1F2D3D]">
              Kiến Trúc Hệ Thống 3 Lớp (Frontend - API Gateway/Backend - Databases)
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Phân tách rõ ràng giữa lớp giao diện hiển thị, lớp điều hướng bảo mật, lớp nghiệp vụ lõi và lớp dữ liệu lưu trữ
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
            
            {/* Lớp 1: Frontend */}
            <div className="p-5 rounded-2xl border border-[#A8DCD5] bg-[#E8F4F3]/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#0F9D8F] bg-white px-2 py-0.5 rounded-sm border border-[#A8DCD5]">
                  Lớp Giao Diện (Frontend)
                </span>
                <h4 className="text-sm font-bold text-[#1F2D3D] mt-2 mb-2">
                  React / Vite + Mapbox GL JS / WebGL
                </h4>
                <ul className="text-xs space-y-1.5 text-[#5B6B7B]">
                  <li>• <strong>3.1. Khám phá & Tương tác:</strong> 5 tabs thông tin, Heatmap mật độ/GDP/dân số</li>
                  <li>• <strong>3.2. Cá nhân hóa:</strong> Sổ tay du lịch, Travel Planner tối ưu</li>
                  <li>• <strong>3.3. Gamification:</strong> Huy hiệu, điểm thưởng, BXH</li>
                  <li>• <strong>3.4. Cộng đồng (UGC):</strong> Review, vote sao, upload ảnh</li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-[#D5E3E3] text-[11px] text-[#0B5F57] font-semibold">
                Client-side rendering mượt mà
              </div>
            </div>

            {/* Lớp 2: API Gateway */}
            <div className="p-5 rounded-2xl border border-amber-300 bg-amber-50/40 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#F5B83D] bg-white px-2 py-0.5 rounded-sm border border-amber-300">
                  Cổng Điều Hướng
                </span>
                <h4 className="text-sm font-bold text-[#1F2D3D] mt-2 mb-2">
                  API Gateway / Load Balancer
                </h4>
                <ul className="text-xs space-y-1.5 text-[#5B6B7B]">
                  <li>• Tiếp nhận toàn bộ HTTP Request (RESTful API)</li>
                  <li>• Phân luồng yêu cầu & bảo mật xác thực Token/Session</li>
                  <li>• Điều hướng giữa Core Logic và CMS Admin</li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 text-[11px] text-[#F5B83D] font-bold">
                Reverse Proxy & API Router
              </div>
            </div>

            {/* Lớp 3: Backend Logic */}
            <div className="p-5 rounded-2xl border border-red-300 bg-red-50/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#E5484D] bg-white px-2 py-0.5 rounded-sm border border-red-200">
                  Lớp Nghiệp Vụ (Backend)
                </span>
                <h4 className="text-sm font-bold text-[#1F2D3D] mt-2 mb-2">
                  Node.js + Express.js Core
                </h4>
                <ul className="text-xs space-y-1.5 text-[#5B6B7B]">
                  <li>• <strong>Hệ thống Lõi:</strong> Thuật toán Travel Planner (Haversine distance sorting, route slotting)</li>
                  <li>• Tính toán Gamification điểm/huy hiệu</li>
                  <li>• <strong>3.5. CMS Admin:</strong> Quản lý Tỉnh/Thành, Workflow duyệt UGC</li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-red-200 text-[11px] text-[#E5484D] font-bold">
                Non-blocking I/O hiệu năng cao
              </div>
            </div>

            {/* Lớp 4: Databases */}
            <div className="p-5 rounded-2xl border border-blue-300 bg-blue-50/30 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-blue-600 bg-white px-2 py-0.5 rounded-sm border border-blue-200">
                  Cơ Sở Dữ Liệu
                </span>
                <h4 className="text-sm font-bold text-[#1F2D3D] mt-2 mb-2">
                  MySQL 8.0 & Media DB
                </h4>
                <ul className="text-xs space-y-1.5 text-[#5B6B7B]">
                  <li>• <strong>Core DB:</strong> Users, Provinces (geo_polygon JSON), Locations, Travel_Notebooks, Badges</li>
                  <li>• <strong>Media DB:</strong> Lưu trữ chuỗi ảnh thực tế và bài Reviews</li>
                  <li>• Ràng buộc khóa ngoại (Foreign Keys) chặt chẽ</li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-200 text-[11px] text-blue-700 font-bold">
                Relational + Spatial Data
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAM) */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#D5E3E3]">
            <h3 className="text-base font-bold text-[#1F2D3D]">
              Sơ Đồ Hoạt Động (Activity Diagram): Luồng "Tạo Lịch Trình Tự Động"
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Quy trình khép kín giữa Khách du lịch (Frontend) ➔ Hệ thống (Backend) ➔ Cơ sở dữ liệu (Database)
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-4">
            
            <div className="flex items-center gap-4 text-xs font-bold text-[#1F2D3D] pb-2 border-b border-[#D5E3E3]">
              <span className="w-1/3 text-center bg-white p-2 rounded-lg border border-[#D5E3E3]">
                1. Khách Du Lịch (Frontend)
              </span>
              <span className="w-1/3 text-center bg-white p-2 rounded-lg border border-[#D5E3E3]">
                2. Hệ Thống (Backend / Core Logic)
              </span>
              <span className="w-1/3 text-center bg-white p-2 rounded-lg border border-[#D5E3E3]">
                3. Cơ Sở Dữ Liệu (Database)
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#D5E3E3] flex items-center justify-between">
                <span>[1] Chọn các tỉnh/thành muốn đi + nhập thời gian & sở thích</span>
                <span className="text-[#0F9D8F] font-bold">Bấm "Tạo lịch trình" ➔</span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <span className="text-[#5B6B7B]">Kiểm tra tính hợp lệ dữ liệu (ít nhất 1 điểm đến)</span>
                <span className="text-[#0B5F57] font-bold">Hợp lệ ➔ Truy vấn DB</span>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <span>Truy xuất bảng Provinces (tọa độ lat, lng) & Locations (món đặc sản, danh thắng)</span>
                <span className="text-blue-700 font-bold">Trả về dữ liệu thô ➔</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <p className="font-bold text-[#2E9E5B]">Chạy thuật toán lõi:</p>
                <p className="text-[#5B6B7B]">
                  • Sắp xếp lộ trình theo khoảng cách ngắn nhất (Haversine)<br/>
                  • Phân bổ điểm đến theo ngày (08:00, 10:30, 14:30)<br/>
                  • Ghép món ăn nổi tiếng vào tuyến đường (12:00, 18:30)<br/>
                  • Hiển thị bản xem trước lịch trình hoàn chỉnh
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#D5E3E3] flex items-center justify-between">
                <span>Khách du lịch xem xét lịch trình: Đồng ý & Bấm "Lưu vào Sổ tay"</span>
                <span className="text-[#0F9D8F] font-bold">Lệnh INSERT ➔</span>
              </div>

              <div className="p-3 bg-emerald-100 rounded-xl border border-emerald-300 font-bold text-[#0B5F57] text-center">
                ✓ Insert vào bảng Travel_Notebooks ➔ Thông báo thành công & Tích điểm Gamification (+40đ)
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: THIẾT KẾ DATABASE */}
      {activeTab === 'database' && (
        <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#D5E3E3]">
            <div>
              <h3 className="text-base font-bold text-[#1F2D3D]">
                Mã Khởi Tạo CSDL MySQL (VietnamTravelMap DDL Script)
              </h3>
              <p className="text-xs text-[#5B6B7B]">
                Bao gồm 7 bảng: Users, Provinces, Locations, Travel_Notebooks, Reviews, Badges, User_Badges
              </p>
            </div>

            <button
              onClick={copySQL}
              className="px-3.5 py-1.5 bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              {copiedSQL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSQL ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
            </button>
          </div>

          <div className="bg-[#1F2D3D] text-slate-100 p-4 rounded-2xl overflow-x-auto font-mono text-xs max-h-96">
            <pre>{SQL_SCHEMA}</pre>
          </div>

          <div className="p-4 rounded-xl bg-[#F7FAFA] border border-[#D5E3E3] text-xs space-y-1.5 text-[#5B6B7B]">
            <p className="font-bold text-[#1F2D3D]">📌 Điểm nhấn thiết kế kỹ thuật DB:</p>
            <p>• <strong>Dữ liệu không gian (geo_polygon):</strong> Cột kiểu JSON trong bảng Provinces lưu tọa độ biên giới tỉnh thành để Frontend Mapbox/SVG render Heatmap trực tiếp.</p>
            <p>• <strong>Khoảng cách Haversine:</strong> Tọa độ lat, lng kiểu DECIMAL(10,8) ở bảng Locations phục vụ tính toán khoảng cách ngắn nhất.</p>
            <p>• <strong>Workflow kiểm duyệt UGC:</strong> Bảng Reviews có cột status ENUM('Pending', 'Approved', 'Rejected') mặc định là Pending.</p>
          </div>
        </div>
      )}

      {/* TAB 5: SƠ ĐỒ TUẦN TỰ */}
      {activeTab === 'sequence' && (
        <div className="bg-white rounded-2xl p-6 border border-[#D5E3E3] shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#D5E3E3]">
            <h3 className="text-base font-bold text-[#1F2D3D]">
              Sơ Đồ Tuần Tự (Sequence Diagram & REST API Flow)
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Luồng dữ liệu JSON giữa Frontend ➔ Gateway ➔ Backend Core ➔ Database
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-2">
              <h4 className="font-bold text-[#0F9D8F]">1. Giai đoạn 1: Khởi tạo Lịch trình</h4>
              <p className="text-[#5B6B7B]">
                • <code>POST /api/v1/planner/generate</code>
              </p>
              <pre className="p-2.5 bg-white rounded-xl border border-[#D5E3E3] text-[11px] font-mono text-[#0B5F57]">
{`// HTTP Request Payload:
{
  "provinces": ["Đà Nẵng", "Huế"],
  "duration": "3 Ngày 2 Đêm",
  "preferences": ["Ẩm thực", "Di tích"]
}

// HTTP Response Payload (200 OK):
{
  "status": "success",
  "data": {
    "day_1": [
      {"time": "08:00", "activity": "Tham quan Danh thắng A"},
      {"time": "12:00", "activity": "Ăn trưa Món đặc sản B"}
    ]
  }
}`}
              </pre>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] space-y-2">
              <h4 className="font-bold text-[#0F9D8F]">2. Giai đoạn 2: Lưu Sổ tay du lịch</h4>
              <p className="text-[#5B6B7B]">
                • <code>POST /api/v1/notebook/save</code>
              </p>
              <pre className="p-2.5 bg-white rounded-xl border border-[#D5E3E3] text-[11px] font-mono text-[#0B5F57]">
{`// HTTP Request Payload:
{
  "user_id": 1024,
  "location_ids": [101, 103],
  "status": "Wishlist"
}

// Backend Execution:
INSERT INTO Travel_Notebooks (user_id, location_id, status)
VALUES (1024, 101, 'Wishlist');

// HTTP Response Payload (200 OK):
{
  "status": "success",
  "message": "Đã lưu vào Sổ tay hành trình thành công."
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
