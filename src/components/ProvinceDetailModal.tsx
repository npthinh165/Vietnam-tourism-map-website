import { useState } from "react";
import {
  CalendarDays,
  Check,
  Heart,
  MapPin,
  MessageSquare,
  Star,
} from "lucide-react";
import type { LocationCategory, LocationItem, Province } from "../types";
import { apiService } from "../services/apiService";
import Dialog from "./ui/Dialog";

interface ProvinceDetailModalProps {
  province: Province;
  onClose: () => void;
  onOpenReviewModal: (location?: LocationItem) => void;
  onOpenLocationReviews: (location: LocationItem) => void;
  isProvinceVisited: boolean;
  onToggleProvinceVisited: (id: number) => void;
  onRefreshData: () => void;
  onSelectLocationCard: (location: LocationItem) => void;
  onPlanProvince: (province: Province) => void;
  onRequireAuth: (action: () => void) => void;
}
const categories: { id: LocationCategory; label: string }[] = [
  { id: "Landmark", label: "Danh thắng" },
  { id: "Food", label: "Ẩm thực" },
  { id: "History", label: "Lịch sử" },
  { id: "Geography", label: "Thiên nhiên" },
  { id: "Festival", label: "Lễ hội" },
];
export function ProvinceDetailModal({
  province,
  onClose,
  onOpenReviewModal,
  onOpenLocationReviews,
  isProvinceVisited,
  onToggleProvinceVisited,
  onRefreshData,
  onSelectLocationCard,
  onPlanProvince,
  onRequireAuth,
}: ProvinceDetailModalProps) {
  const [category, setCategory] = useState<LocationCategory>("Landmark");
  const [error, setError] = useState("");
  const locations = apiService.getLocations(province.province_id, category);
  const notebook = apiService.getNotebook();
  const toggle = (location: LocationItem, status: "Visited" | "Wishlist") =>
    onRequireAuth(() => {
      try {
        apiService.toggleNotebookLocation(location, status);
        onRefreshData();
        setError("");
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Chưa thể lưu điểm đến.",
        );
      }
    });
  const description =
    category === "History"
      ? province.history_brief
      : category === "Geography"
        ? province.geography_brief
        : category === "Food"
          ? province.specialty_dish
          : category === "Festival"
            ? province.top_festival
            : province.description;

  return (
    <Dialog
      title={province.name}
      description={
        "Miền " +
        (province.region === "Bac"
          ? "Bắc"
          : province.region === "TayNguyen"
            ? "Trung"
            : province.region)
      }
      onClose={onClose}
      className="!max-w-4xl"
    >
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={() => onPlanProvince(province)}
        >
          <CalendarDays size={16} />
          Lên lịch trình
        </button>
        <button
          className={
            isProvinceVisited
              ? "btn-secondary !border-teal-200 !bg-teal-50 !text-teal-800"
              : "btn-secondary"
          }
          onClick={() => onToggleProvinceVisited(province.province_id)}
          aria-pressed={isProvinceVisited}
        >
          <Check size={16} />
          {isProvinceVisited ? "Đã đến" : "Đánh dấu đã đến"}
        </button>
      </div>
      <div
        className="my-5 flex gap-1 overflow-x-auto border-b border-slate-200"
        aria-label="Danh mục điểm đến"
      >
        {categories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${category === item.id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {description && (
        <p className="mb-5 text-sm leading-7 text-slate-600">{description}</p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {locations.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((location) => {
            const status = notebook.find(
              (entry) => entry.location_id === location.location_id,
            )?.status;
            return (
              <article
                key={location.location_id}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <div className="relative h-36 bg-slate-100">
                  <img
                    src={location.image_url || province.cover_image}
                    alt={location.name}
                    loading="lazy"
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-6">
                      {location.name}
                    </h3>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate-600">
                      <Star size={13} className="text-amber-500" />
                      {location.rating_star}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {location.address}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {location.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => toggle(location, "Wishlist")}
                      aria-pressed={status === "Wishlist"}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs ${status === "Wishlist" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}
                    >
                      <Heart size={13} />
                      {status === "Wishlist" ? "Đã lưu" : "Muốn đến"}
                    </button>
                    <button
                      onClick={() => toggle(location, "Visited")}
                      aria-pressed={status === "Visited"}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs ${status === "Visited" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}
                    >
                      <Check size={13} />
                      Đã đến
                    </button>
                    <button
                      onClick={() => onSelectLocationCard(location)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-teal-700"
                    >
                      <MapPin size={13} />
                      Bản đồ
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <button
                      onClick={() => onOpenLocationReviews(location)}
                      className="flex items-center gap-1 text-slate-500"
                    >
                      <MessageSquare size={13} />
                      Đánh giá
                    </button>
                    <button
                      onClick={() => onOpenReviewModal(location)}
                      className="font-medium text-teal-700"
                    >
                      Viết đánh giá
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
          Điểm đến đang được cập nhật.
        </div>
      )}
    </Dialog>
  );
}
