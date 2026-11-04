import { Star } from "lucide-react";
import type { LocationItem } from "../types";
import { apiService } from "../services/apiService";
import Dialog from "./ui/Dialog";

export function LocationReviewsModal({
  location,
  onClose,
  onOpenAddReview,
}: {
  location: LocationItem;
  onClose: () => void;
  onOpenAddReview: () => void;
}) {
  const reviews = apiService
    .getReviews("Approved")
    .filter((review) => review.location_id === location.location_id);
  return (
    <Dialog
      title="Đánh giá"
      description={location.name}
      onClose={onClose}
      className="!max-w-xl"
    >
      <div className="my-5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm text-slate-500">
          <Star size={15} className="text-amber-500" />
          {location.rating_star} · {reviews.length} đánh giá
        </span>
        <button className="btn-secondary" onClick={onOpenAddReview}>
          Viết đánh giá
        </button>
      </div>
      {reviews.length ? (
        <div className="space-y-5">
          {reviews.map((review) => (
            <article
              key={review.review_id}
              className="border-t border-slate-100 pt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{review.username}</h3>
                <span className="text-xs text-slate-500">
                  {review.rating_star}/5 sao
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {review.content}
              </p>
              {review.image_url && (
                <img
                  alt="Ảnh trải nghiệm"
                  src={review.image_url}
                  loading="lazy"
                  className="mt-3 max-h-48 rounded-lg object-cover"
                />
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
          Chưa có đánh giá được duyệt.
        </p>
      )}
    </Dialog>
  );
}
