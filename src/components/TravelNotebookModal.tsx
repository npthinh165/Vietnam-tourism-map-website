import { useState } from "react";
import { BookOpen, CalendarDays, MapPin, Trash2 } from "lucide-react";
import type { User } from "../types";
import { apiService } from "../services/apiService";

interface NotebookProps {
  currentUser: User;
  onRefreshData: () => void;
  onSelectProvinceName: (name: string) => void;
  onSignIn: () => void;
  onExplore: () => void;
  onPlan: () => void;
}
type NotebookTab = "plans" | "wishlist" | "visited";
const tabs: { id: NotebookTab; label: string }[] = [
  { id: "plans", label: "Lịch trình" },
  { id: "wishlist", label: "Muốn đến" },
  { id: "visited", label: "Đã đến" },
];

export function TravelNotebookModal({
  currentUser,
  onRefreshData,
  onSelectProvinceName,
  onSignIn,
  onExplore,
  onPlan,
}: NotebookProps) {
  const [tab, setTab] = useState<NotebookTab>("plans");
  const [error, setError] = useState("");
  const entries = apiService.getNotebook(),
    itineraries = apiService.getSavedItineraries();
  const shown = entries.filter(
    (entry) => entry.status === (tab === "visited" ? "Visited" : "Wishlist"),
  );
  const visitedProvinces = apiService
    .getProvinces()
    .filter((p) => currentUser.visited_provinces.includes(p.province_id));
  const counts = {
    plans: itineraries.length,
    wishlist: entries.filter((e) => e.status === "Wishlist").length,
    visited: entries.filter((e) => e.status === "Visited").length,
  };
  const remove = (id: number | string) => {
    try {
      if (typeof id === "number") apiService.removeNotebookEntry(id);
      else apiService.removeSavedItinerary(id);
      onRefreshData();
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Chưa thể xóa. Vui lòng thử lại.",
      );
    }
  };
  const empty = (
    title: string,
    description: string,
    action: () => void,
    text: string,
  ) => (
    <div className="panel flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="rounded-2xl bg-teal-50 p-4 text-teal-700">
        <BookOpen size={30} strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      <button className="btn-primary mt-6" onClick={action}>
        {text}
      </button>
    </div>
  );

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      aria-labelledby="notebook-title"
    >
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="notebook-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Sổ tay hành trình
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Những điểm đến và chuyến đi của bạn.
          </p>
        </div>
        {currentUser.role !== "guest" && (
          <button className="btn-secondary" onClick={onPlan}>
            <CalendarDays size={16} />
            Lên lịch trình
          </button>
        )}
      </header>
      {currentUser.role === "guest" ? (
        empty(
          "Lưu giữ chuyến đi của bạn",
          "Đăng nhập để lưu lịch trình và điểm đến yêu thích.",
          onSignIn,
          "Đăng nhập",
        )
      ) : (
        <>
          <div
            className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200"
            aria-label="Nội dung sổ tay"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === item.id ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500"}`}
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {tab === "visited" && visitedProvinces.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {visitedProvinces.map((p) => (
                <button
                  key={p.province_id}
                  onClick={() => onSelectProvinceName(p.name)}
                  className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-800"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {tab === "plans" ? (
            itineraries.length ? (
              <div className="space-y-4">
                {itineraries.map((plan) => (
                  <article key={plan.id} className="panel p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-semibold">{plan.title}</h2>
                        <p className="mt-2 text-sm text-slate-500">
                          {plan.duration} ·{" "}
                          {new Date(plan.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </p>
                      </div>
                      <button
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                        onClick={() => remove(plan.id)}
                        aria-label={"Xóa lịch trình " + plan.title}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <details className="mt-4 border-t border-slate-100 pt-4">
                      <summary className="cursor-pointer text-sm font-medium text-teal-700">
                        Xem lịch trình
                      </summary>
                      <div className="mt-4 space-y-5">
                        {plan.days.map((day) => (
                          <section key={day.day}>
                            <h3 className="mb-3 text-sm font-semibold">
                              Ngày {day.day} · {day.title}
                            </h3>
                            <ol className="space-y-3 border-l border-slate-200 pl-4">
                              {day.activities.map((activity, index) => (
                                <li key={index} className="flex gap-3">
                                  <span className="w-12 shrink-0 text-xs text-slate-500">
                                    {activity.time}
                                  </span>
                                  <p className="text-sm text-slate-700">
                                    {activity.title}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          </section>
                        ))}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              empty(
                "Chưa có lịch trình đã lưu",
                "Tạo lịch trình cho chuyến đi tiếp theo và lưu vào đây.",
                onPlan,
                "Lên lịch trình",
              )
            )
          ) : shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {shown.map((entry) => (
                <article
                  key={entry.notebook_id}
                  className="panel flex items-start justify-between gap-3 p-5"
                >
                  <div>
                    <h2 className="font-semibold">{entry.item_name}</h2>
                    <button
                      onClick={() => onSelectProvinceName(entry.province_name)}
                      className="mt-2 flex items-center gap-1 text-sm text-teal-700"
                    >
                      <MapPin size={14} />
                      {entry.province_name}
                    </button>
                    {entry.notes && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  <button
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(entry.notebook_id)}
                    aria-label={"Xóa " + entry.item_name + " khỏi sổ tay"}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            empty(
              tab === "wishlist"
                ? "Bạn muốn đến đâu tiếp theo?"
                : "Ghi lại những nơi đã đến",
              "Chọn điểm đến trên bản đồ để thêm vào sổ tay.",
              onExplore,
              "Khám phá bản đồ",
            )
          )}
        </>
      )}
    </section>
  );
}
