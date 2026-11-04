import { useState } from "react";
import type { LocationItem } from "../types";
import { type PlaceReview, reviewSchema } from "../../shared/travel";
import { request } from "../services/httpClient";
import Dialog from "../components/ui/Dialog";
import { useAuth } from "./auth";
import { usePagedResource } from "./usePagedResource";
import { provinceForPreviousId } from "../../shared/provinces";

export function DestinationDialog({
  place,
  onClose,
  onSignIn,
  onChanged,
}: {
  place: LocationItem;
  onClose: () => void;
  onSignIn: () => void;
  onChanged: () => void;
}) {
  const { user, refresh } = useAuth(),
    reviews = usePagedResource<PlaceReview>(
      `/v1/places/${place.location_id}/reviews`,
    );
  const [rating, setRating] = useState(5),
    [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const checkIn = async () => {
    if (!user) {
      onSignIn();
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!navigator.geolocation)
        throw new Error("Trình duyệt không hỗ trợ vị trí.");
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            resolve,
            () =>
              reject(
                new Error(
                  "Chưa lấy được vị trí. Hãy bật quyền truy cập vị trí và thử lại.",
                ),
              ),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          ),
      );
      const result = await request<{ awarded: number }>(
        `/v1/places/${place.location_id}/checkin`,
        {
          method: "POST",
          body: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          },
        },
      );
      setNotice(`Đã check-in. +${result.awarded} điểm.`);
      await refresh();
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Không thể check-in.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={place.name}
      description={provinceForPreviousId(place.province_id)?.name}
      className="!max-w-2xl"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <img
        src={place.image_url}
        alt={place.name}
        referrerPolicy="no-referrer"
        className="mt-5 h-52 w-full rounded-2xl object-cover"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
      <p className="mt-3 text-sm text-muted">
        Địa chỉ tham khảo: {place.address}
      </p>
      <section className="my-5 space-y-3" aria-label="Giới thiệu địa điểm">
        <h2 className="text-lg font-semibold">Giới thiệu</h2>
        <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
          {place.description}
        </p>
        {place.article && (
          <>
            <h3 className="pt-2 font-semibold">Khám phá {place.name}</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {place.article}
            </p>
          </>
        )}
      </section>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() => void checkIn()}
      >
        {busy ? "Đang xử lý…" : "Check-in tại đây"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Cần vị trí trong phạm vi 1 km, độ chính xác tối đa 200 m.
      </p>
      {notice && (
        <p role="status" className="my-4 text-brand">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="my-4 text-red-700">
          {error}
        </p>
      )}
      <form
        className="my-6 space-y-4 border-t border-slate-200 pt-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!user) {
            onSignIn();
            return;
          }
          if (busy) return;
          const parsed = reviewSchema.safeParse({ rating, content });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const result = await request<{ awarded: number }>(
              `/v1/places/${place.location_id}/review`,
              { method: "PUT", body: parsed.data },
            );
            setNotice(`Đã lưu đánh giá. +${result.awarded} điểm.`);
            setContent("");
            await reviews.reload();
            await refresh();
            onChanged();
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Không thể lưu đánh giá.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">Đánh giá trải nghiệm</h2>
        <label className="field-label">
          Điểm đánh giá
          <select
            className="field mt-1"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} sao
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Nội dung
          <textarea
            className="field mt-1"
            required
            minLength={20}
            maxLength={3000}
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted">
          Gửi lại sẽ cập nhật đánh giá trước của bạn tại điểm đến này.
        </p>
        <button className="btn-primary" disabled={busy}>
          Lưu đánh giá
        </button>
      </form>
      <h2 className="font-semibold">Đánh giá từ cộng đồng</h2>
      {reviews.error && (
        <p role="alert" className="mt-3 text-red-700">
          {reviews.error}{" "}
          <button onClick={() => void reviews.reload()}>Thử lại</button>
        </p>
      )}
      <div className="mt-4 space-y-4">
        {reviews.items.map((review) => (
          <article key={review.id} className="rounded-xl bg-paper p-4">
            <p className="font-semibold">
              {review.user.name} · {review.rating}/5 ★
            </p>
            <p className="prose-travel mt-2 text-sm">{review.content}</p>
            <p className="mt-2 text-xs text-muted">
              {new Date(review.createdAt).toLocaleDateString("vi-VN")}
            </p>
          </article>
        ))}
      </div>
      {reviews.loading && <p role="status">Đang tải…</p>}
      {!reviews.loading && !reviews.error && !reviews.items.length && (
        <p className="my-4 text-sm text-muted">Chưa có đánh giá.</p>
      )}
      {reviews.hasMore && (
        <button
          className="btn-secondary mt-4"
          disabled={reviews.loading}
          onClick={() => void reviews.more()}
        >
          Xem thêm đánh giá
        </button>
      )}
    </Dialog>
  );
}
