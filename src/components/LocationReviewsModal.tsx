import React from 'react';
import { LocationItem, Review } from '../types';
import { apiService } from '../services/apiService';
import { X, Star, MessageSquare, PlusCircle, CheckCircle2, User } from 'lucide-react';

interface LocationReviewsModalProps {
  location: LocationItem;
  onClose: () => void;
  onOpenAddReview: () => void;
}

export const LocationReviewsModal: React.FC<LocationReviewsModalProps> = ({
  location,
  onClose,
  onOpenAddReview
}) => {
  const allReviews = apiService.getReviews();
  const locationReviews = allReviews.filter(
    r => (r.location_id === location.location_id || r.location_name.includes(location.name)) && r.status === 'Approved'
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-[#D5E3E3] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#F7FAFA] border-b border-[#D5E3E3] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0F9D8F]" />
              Đánh Giá Cộng Đồng (UGC): {location.name}
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Đánh giá thực tế từ khách du lịch đã đặt chân đến đây
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#E8F4F3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Bar */}
        <div className="px-6 py-3 bg-white border-b border-[#D5E3E3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-base font-extrabold text-[#FF8A5B]">
              <Star className="w-4 h-4 fill-[#FF8A5B]" />
              <span>{location.rating_star}</span>
            </div>
            <span className="text-xs text-[#5B6B7B]">
              ({locationReviews.length} bài đánh giá đã duyệt)
            </span>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenAddReview();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Viết đánh giá của bạn</span>
          </button>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {locationReviews.length === 0 ? (
            <div className="p-8 text-center bg-[#F7FAFA] rounded-2xl border border-[#D5E3E3]">
              <MessageSquare className="w-8 h-8 text-[#5CC0B4] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1F2D3D]">Chưa có bài đánh giá nào được duyệt</p>
              <p className="text-xs text-[#5B6B7B] mt-1">
                Hãy là người đầu tiên chia sẻ cảm nhận và hình ảnh thực tế về {location.name}!
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAddReview();
                }}
                className="mt-4 px-4 py-2 bg-[#0F9D8F] text-white text-xs font-bold rounded-xl"
              >
                + Đăng bài đánh giá đầu tiên (+30đ)
              </button>
            </div>
          ) : (
            locationReviews.map((rev) => (
              <div
                key={rev.review_id}
                className="p-4 rounded-2xl border border-[#D5E3E3] bg-[#F7FAFA] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#0F9D8F] text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                      {rev.username.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1F2D3D]">{rev.username}</p>
                      <p className="text-[10px] text-[#5B6B7B]">{rev.created_at}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating_star ? 'fill-[#FF8A5B] text-[#FF8A5B]' : 'text-[#D5E3E3]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#1F2D3D] leading-relaxed">
                  {rev.content}
                </p>

                {rev.image_url && (
                  <div className="relative h-40 rounded-xl overflow-hidden border border-[#D5E3E3] max-w-sm">
                    <img
                      src={rev.image_url}
                      alt="Review attachment"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1 text-[11px] text-[#2E9E5B] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã kiểm duyệt bởi Ban quản trị</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
