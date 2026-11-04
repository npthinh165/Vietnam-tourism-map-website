import { useState } from "react";
import { Star } from "lucide-react";
import type { LocationItem, Province } from "../types";
import { apiService } from "../services/apiService";
import Dialog from "./ui/Dialog";

export function ReviewModal({
  location,
  province,
  onClose,
  onSuccess,
}: {
  location?: LocationItem | null;
  province?: Province | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(5),
    [content, setContent] = useState("");
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (content.trim().length < 10) {
      setError("Vui lòng viết ít nhất 10 ký tự.");
      return;
    }
    if (!location) {
      setError("Vui lòng chọn một điểm đến để đánh giá.");
      return;
    }
    try {
      const user = apiService.getCurrentUser();
      apiService.submitReview({
        user_id: user.user_id,
        username: user.username,
        user_avatar: user.avatar,
        location_id: location.location_id,
        location_name: location.name,
        province_name:
          province?.name ||
          apiService.getProvinceById(location.province_id)?.name ||
          "",
        rating_star: rating,
        content: content.trim(),
        image_url: image || undefined,
      });
      setSuccess(true);
      onSuccess();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chưa thể gửi đánh giá.",
      );
    }
  };
  return (
    <Dialog
      title="Viết đánh giá"
      description={location?.name}
      onClose={onClose}
    >
      {success ? (
        <div className="mt-6">
          <p
            role="status"
            className="rounded-lg bg-teal-50 p-4 text-sm text-teal-800"
          >
            Đã lưu đánh giá, đang chờ duyệt.
          </p>
          <button className="btn-primary mt-5 w-full" onClick={onClose}>
            Hoàn tất
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          <fieldset>
            <legend className="field-label">Trải nghiệm của bạn</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value + " sao"}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className="rounded p-1"
                >
                  <Star
                    size={26}
                    className={
                      value <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="field-label" htmlFor="review-content">
              Nội dung
            </label>
            <textarea
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              className="field"
              placeholder="Chia sẻ trải nghiệm của bạn…"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-photo">
              Ảnh (không bắt buộc)
            </label>
            <input
              id="review-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full text-sm text-slate-500"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setImage("");
                if (!file) return;
                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    file.type,
                  ) ||
                  file.size > 1024 * 1024
                ) {
                  setError("Chọn ảnh JPG, PNG hoặc WebP dưới 1 MB.");
                  event.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setImage(String(reader.result));
                  setError("");
                };
                reader.onerror = () => setError("Không thể đọc ảnh.");
                reader.readAsDataURL(file);
              }}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" type="submit">
            Gửi đánh giá
          </button>
        </form>
      )}
    </Dialog>
  );
}
