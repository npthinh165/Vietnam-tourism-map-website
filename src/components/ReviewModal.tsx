import React, { useState } from 'react';
import { LocationItem, Province } from '../types';
import { apiService } from '../services/apiService';
import { 
  X, 
  Star, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Camera
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReviewModalProps {
  location?: LocationItem | null;
  province?: Province | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  location,
  province,
  onClose,
  onSuccess
}) => {
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string>(
    '/src/assets/images/vietnam_culinary_food_1791335176027.jpg'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successResponse, setSuccessResponse] = useState<{
    review_id: number;
    status: string;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUser = apiService.getCurrentUser();

  const handleSelectSampleImage = (img: string) => {
    setSelectedImage(img);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung đánh giá của bạn (tối thiểu 10 ký tự).');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const newReview = apiService.submitReview({
        user_id: currentUser.user_id,
        username: currentUser.username,
        user_avatar: currentUser.avatar,
        location_id: location?.location_id || 101,
        location_name: location?.name || `${province?.name || 'Việt Nam'} - Trải nghiệm địa phương`,
        province_name: province?.name || 'Đà Nẵng',
        rating_star: rating,
        content: content,
        image_url: selectedImage
      });

      setIsSubmitting(false);
      setSuccessResponse({
        review_id: newReview.review_id,
        status: newReview.status,
        message: 'Bài đánh giá đã được gửi và đang chờ kiểm duyệt (Pending).'
      });

      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5 }
        });
      } catch {
        // ignore
      }

      onSuccess();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-[#D5E3E3] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#F7FAFA] border-b border-[#D5E3E3] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1F2D3D] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#FF8A5B]" />
              Đăng Tải Đánh Giá & Hình Ảnh (UGC)
            </h3>
            <p className="text-xs text-[#5B6B7B]">
              Quy trình đóng góp nội dung cộng đồng · Kiểm duyệt bởi Admin CMS
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5B6B7B] hover:text-[#1F2D3D] hover:bg-[#E8F4F3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successResponse ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#2E9E5B] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-[#1F2D3D]">
              Gửi Đánh Giá Thành Công!
            </h4>
            <div className="p-4 rounded-2xl bg-[#F7FAFA] border border-[#D5E3E3] text-left text-xs space-y-1.5 font-mono">
              <p className="text-[#5B6B7B]">HTTP 200 Response Payload:</p>
              <pre className="text-[11px] text-[#0B5F57] overflow-x-auto p-2 bg-white rounded-lg border border-[#D5E3E3]">
{JSON.stringify(
  {
    status: "success",
    message: successResponse.message,
    data: {
      review_id: successResponse.review_id,
      review_status: successResponse.status,
      points_awarded: 30
    }
  },
  null,
  2
)}
              </pre>
            </div>
            <p className="text-xs text-[#5B6B7B]">
              Bài viết của bạn đã được gắn cờ <span className="text-[#F5B83D] font-bold">Pending (Chờ duyệt)</span> và sẽ hiển thị công khai trên bản đồ sau khi Quản trị viên duyệt trên CMS. Bạn nhận được <span className="text-[#0F9D8F] font-bold">+30 Điểm hành trình</span>!
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Đóng và tiếp tục khám phá
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Target Location / Province banner */}
            <div className="p-3.5 rounded-xl bg-[#E8F4F3] border border-[#A8DCD5] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#0B5F57] font-semibold">Địa điểm đánh giá:</span>
                <p className="font-bold text-[#1F2D3D] text-sm">
                  {location?.name || province?.name || 'Đà Nẵng'}
                </p>
              </div>
              <span className="text-[11px] text-[#0F9D8F] bg-white px-2 py-1 rounded-md border border-[#A8DCD5] font-semibold">
                +30 Điểm UGC
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E5484D] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Star Rating */}
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] uppercase tracking-wider mb-2">
                Bình chọn số sao (Rating)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-1.5 transition-transform hover:scale-110 focus:outline-hidden"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        s <= rating
                          ? 'fill-[#FF8A5B] text-[#FF8A5B]'
                          : 'text-[#D5E3E3]'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-[#1F2D3D] ml-2">
                  {rating} / 5 Sao ({rating === 5 ? 'Tuyệt vời' : rating === 4 ? 'Rất tốt' : rating === 3 ? 'Bình thường' : 'Chưa hài lòng'})
                </span>
              </div>
            </div>

            {/* Content Textarea */}
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] uppercase tracking-wider mb-1.5">
                Nội dung đánh giá & Cảm nhận thực tế
              </label>
              <textarea
                rows={4}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn về món ăn đặc sản, hương vị, giá cả, không gian hoặc cảnh quan tại đây..."
                className="w-full p-3 text-xs bg-[#F7FAFA] border border-[#D5E3E3] rounded-xl focus:outline-hidden focus:border-[#0F9D8F] focus:ring-1 focus:ring-[#0F9D8F]"
                required
              />
            </div>

            {/* Image Upload & Selection */}
            <div>
              <label className="block text-xs font-bold text-[#1F2D3D] uppercase tracking-wider mb-1.5">
                Hình ảnh thực tế đính kèm
              </label>
              
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  '/src/assets/images/vietnam_culinary_food_1791335176027.jpg',
                  '/src/assets/images/danang_landmark_1791335159789.jpg',
                  '/src/assets/images/vietnam_travel_hero_1791335147966.jpg'
                ].map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSampleImage(img)}
                    className={`relative h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedImage === img
                        ? 'border-[#0F9D8F] ring-2 ring-[#0F9D8F]/20 scale-95'
                        : 'border-[#D5E3E3] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="sample" className="w-full h-full object-cover" />
                    {selectedImage === img && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-[#0F9D8F] text-white rounded-full flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    )}
                  </div>
                ))}

                <label className="h-16 rounded-xl border-2 border-dashed border-[#D5E3E3] hover:border-[#0F9D8F] flex flex-col items-center justify-center cursor-pointer bg-[#F7FAFA] text-[#5B6B7B] transition-colors">
                  <Upload className="w-4 h-4 text-[#0F9D8F]" />
                  <span className="text-[10px] mt-0.5">Tải ảnh</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {selectedImage && (
                <div className="relative h-28 rounded-xl overflow-hidden border border-[#D5E3E3]">
                  <img src={selectedImage} alt="Selected preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-sm">
                    Xem trước ảnh đính kèm
                  </span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#D5E3E3] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#5B6B7B] hover:text-[#1F2D3D] transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#0F9D8F] hover:bg-[#0B7C71] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#FF8A5B]" />
                    <span>Gửi Bài Đánh Giá (UGC)</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
