import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Page, SessionUser } from "../../shared/travel";
import { request } from "../services/httpClient";
import AdminPlaces from "./AdminPlaces";

type AdminUser = SessionUser & { createdAt: string };
type Overview = Record<
  "users" | "posts" | "reviews" | "itineraries" | "places",
  number
>;
const metrics = {
  users: "Thành viên",
  posts: "Bài viết",
  reviews: "Đánh giá",
  itineraries: "Lịch trình",
  places: "Điểm đến",
};
export default function AdminDashboard({
  onPlacesChanged,
}: {
  onPlacesChanged?: () => void;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setBusy(true);
    void Promise.all([
      request<Overview>("/admin/overview", { signal: controller.signal }),
      request<Page<AdminUser>>("/admin/users", { signal: controller.signal }),
    ])
      .then(([summary, page]) => {
        if (controller.signal.aborted) return;
        setOverview(summary);
        setUsers(page.items);
        setCursor(page.nextCursor);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const more = async () => {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const page = await request<Page<AdminUser>>(
        `/admin/users?cursor=${encodeURIComponent(cursor)}`,
      );
      setUsers((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Chưa tải được thành viên.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="page-shell space-y-6" aria-busy={busy}>
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-teal-700" size={30} />
        <div>
          <h1 className="text-2xl font-bold">Trang quản trị</h1>
          <p className="text-sm text-muted">
            Tổng quan hoạt động và danh sách thành viên.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}{" "}
          <button
            className="underline"
            disabled={busy}
            onClick={() => setAttempt((v) => v + 1)}
          >
            Thử lại
          </button>
        </div>
      )}
      {overview && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(Object.keys(metrics) as (keyof Overview)[]).map((key) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm text-muted">{metrics[key]}</p>
              <p className="mt-2 text-3xl font-bold text-teal-800">
                {overview[key].toLocaleString("vi-VN")}
              </p>
            </div>
          ))}
        </div>
      )}
      <AdminPlaces
        onChanged={() => {
          setAttempt((v) => v + 1);
          onPlacesChanged?.();
        }}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-5 font-semibold">
          Thành viên
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Họ và tên", "Email", "Vai trò", "Điểm", "Ngày tham gia"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap px-5 py-3"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">{user.name}</td>
                  <td className="px-5 py-3">{user.email}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
                  </td>
                  <td className="px-5 py-3">{user.points}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {busy && (
          <p role="status" className="p-5 text-sm text-muted">
            Đang tải…
          </p>
        )}
        {!busy && !error && !users.length && (
          <p className="p-5 text-sm text-muted">Chưa có thành viên.</p>
        )}
        {cursor && (
          <button
            className="btn-secondary m-5"
            disabled={busy}
            onClick={() => void more()}
          >
            Xem thêm thành viên
          </button>
        )}
      </div>
    </section>
  );
}
