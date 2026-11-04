import { useState } from "react";
import {
  DAILY_CAPS,
  REWARDS,
  TIERS,
  tierFor,
  type PointRecord,
} from "../../shared/travel";
import { request } from "../services/httpClient";
import { useAuth } from "./auth";
import { usePagedResource } from "./usePagedResource";

const reasons = {
  SIGNUP: "Đăng ký tài khoản",
  REVIEW: "Đánh giá điểm đến",
  ITINERARY: "Tạo hành trình",
  CHECKIN: "Check-in",
};
export function LoyaltyProfile() {
  const { user, refresh } = useAuth(),
    ledger = usePagedResource<PointRecord>(user ? "/v1/rewards" : null);
  const [name, setName] = useState(user?.name || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  if (!user) return null;
  const tier = tierFor(user.points),
    next = TIERS.find((t) => t.min > user.points);
  const progress = next
    ? Math.min(100, ((user.points - tier.min) / (next.min - tier.min)) * 100)
    : 100;
  return (
    <section className="page-shell max-w-3xl">
      <h1 className="page-title">Hồ sơ & thành viên</h1>
      <div className="panel my-6 p-6">
        <p className="text-sm text-muted">Hạng thành viên</p>
        <h2 className="mt-2 text-3xl font-bold text-brand">
          {tier.name} · {user.points} điểm
        </h2>
        <progress
          className="my-4 h-3 w-full accent-teal-700"
          aria-label="Tiến độ hạng thành viên"
          max={100}
          value={progress}
        />
        <p className="text-sm">
          {next
            ? `Còn ${next.min - user.points} điểm để đạt hạng ${next.name}.`
            : "Bạn đã đạt hạng Kim Cương."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <span
              key={t.key}
              className={`chip ${tier.key === t.key ? "chip-active" : ""}`}
            >
              {t.name}: {t.min}đ
            </span>
          ))}
        </div>
      </div>
      <form
        className="panel space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            await request("/v1/profile", { method: "PATCH", body: { name } });
            await refresh();
            setSaved(true);
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Không thể lưu.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Họ và tên
          <input
            className="field mt-1"
            minLength={2}
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="text-sm text-muted">{user.email}</p>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu hồ sơ"}
        </button>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-brand">
            Đã lưu hồ sơ.
          </p>
        )}
      </form>
      <div className="panel my-6 p-6">
        <h2 className="section-title">Cách tích điểm</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {Object.entries(REWARDS).map(([key, value]) => (
            <li key={key}>
              {reasons[key as keyof typeof reasons]}: +{value} điểm{" "}
              {key === "SIGNUP"
                ? "(một lần)"
                : `(tối đa ${DAILY_CAPS[key as keyof typeof DAILY_CAPS]} lần/ngày)`}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-6 text-muted">
          Mỗi điểm đến chỉ được thưởng đánh giá một lần; check-in một lần mỗi
          ngày tại mỗi điểm đến. Sửa nội dung không cộng thêm điểm. Hạn mức tính
          theo giờ Việt Nam. Điểm đã nhận được giữ trong lịch sử khi bạn xóa
          lịch trình.
        </p>
      </div>
      <h2 className="section-title">Lịch sử tích điểm</h2>
      {ledger.error && (
        <p role="alert" className="my-4 text-red-700">
          {ledger.error}{" "}
          <button onClick={() => void ledger.reload()}>Thử lại</button>
        </p>
      )}
      <ul className="mt-4 divide-y divide-slate-200">
        {ledger.items.map((entry) => (
          <li key={entry.id} className="flex justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-semibold">{reasons[entry.event]}</p>
              <p className="mt-1 text-xs text-muted">
                {new Date(entry.createdAt).toLocaleString("vi-VN")}
                {entry.amount === 0
                  ? " · Đã đạt giới hạn thưởng trong ngày"
                  : ""}
              </p>
            </div>
            <span className="font-bold text-brand">+{entry.amount}</span>
          </li>
        ))}
      </ul>
      {ledger.loading && <p role="status">Đang tải…</p>}
      {ledger.hasMore && (
        <button
          className="btn-secondary"
          disabled={ledger.loading}
          onClick={() => void ledger.more()}
        >
          Xem thêm
        </button>
      )}
    </section>
  );
}
