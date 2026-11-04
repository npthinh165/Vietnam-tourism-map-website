import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Plus, X } from "lucide-react";
import type { Province, SavedItinerary, User } from "../types";
import { apiService } from "../services/apiService";

interface PlannerDraft {
  ids: number[];
  duration: number;
  itinerary: SavedItinerary | null;
}
function readDraft(): PlannerDraft {
  try {
    const value = JSON.parse(
      sessionStorage.getItem("vntravel.planner-draft") || "null",
    );
    if (
      value &&
      Array.isArray(value.ids) &&
      Number.isInteger(value.duration) &&
      value.duration >= 1 &&
      value.duration <= 7
    )
      return value;
  } catch {
    /* A new draft is available when browser storage is unavailable. */
  }
  return { ids: [], duration: 3, itinerary: null };
}
interface TravelPlannerProps {
  provinces: Province[];
  initialProvinceId?: number;
  selectionVersion?: number;
  currentUser: User;
  onRequireAuth: (action: () => void) => void;
  onSavedToNotebook: () => void;
  onOpenNotebook: () => void;
}
const durations = [
  "1 ngày",
  "2 ngày 1 đêm",
  "3 ngày 2 đêm",
  "4 ngày 3 đêm",
  "5 ngày 4 đêm",
  "6 ngày 5 đêm",
  "7 ngày 6 đêm",
];

export function TravelPlanner({
  provinces,
  initialProvinceId,
  selectionVersion,
  currentUser,
  onRequireAuth,
  onSavedToNotebook,
  onOpenNotebook,
}: TravelPlannerProps) {
  const [draft] = useState(readDraft);
  const [selectedIds, setSelectedIds] = useState<number[]>(draft.ids);
  const [duration, setDuration] = useState(draft.duration);
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(
    draft.itinerary,
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (
      initialProvinceId === undefined ||
      !provinces.some((p) => p.province_id === initialProvinceId)
    )
      return;
    setSelectedIds((previous) => {
      if (previous.includes(initialProvinceId)) return previous;
      if (previous.length >= 7) {
        setError("Tối đa 7 tỉnh/thành. Bỏ bớt điểm đến trước khi thêm.");
        return previous;
      }
      setDuration((days) => Math.max(days, previous.length + 1));
      return [...previous, initialProvinceId];
    });
  }, [initialProvinceId, selectionVersion, provinces]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "vntravel.planner-draft",
        JSON.stringify({ ids: selectedIds, duration, itinerary }),
      );
    } catch {
      /* Draft remains in memory. */
    }
  }, [selectedIds, duration, itinerary]);
  useEffect(() => {
    setSaved(
      !!itinerary &&
        apiService
          .getSavedItineraries()
          .some((plan) => plan.id === itinerary.id),
    );
  }, [currentUser, itinerary]);

  const selected = selectedIds
    .map((id) => provinces.find((p) => p.province_id === id))
    .filter((p): p is Province => Boolean(p));
  const generate = () => {
    if (!selected.length) {
      setError("Chọn ít nhất một tỉnh/thành để tạo lịch trình.");
      return;
    }
    if (selected.length > duration) {
      setError("Số ngày cần bằng hoặc nhiều hơn số tỉnh/thành.");
      return;
    }
    try {
      setItinerary(
        apiService.generateOptimalItinerary(
          selected.map((p) => p.name),
          durations[duration - 1],
          [],
        ),
      );
      setSaved(false);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chưa thể tạo lịch trình.",
      );
    }
  };
  const save = () => {
    if (!itinerary) return;
    const plan = itinerary;
    const saveDraft = () => {
      try {
        apiService.saveItineraryToNotebook(plan);
        setSaved(true);
        setError("");
        sessionStorage.removeItem("vntravel.pending-plan");
        onSavedToNotebook();
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Chưa thể lưu lịch trình.",
        );
      }
    };
    if (apiService.getCurrentUser().role === "guest") {
      try {
        sessionStorage.setItem("vntravel.pending-plan", JSON.stringify(plan));
      } catch {
        /* Password login can still resume in memory. */
      }
      onRequireAuth(saveDraft);
    } else saveDraft();
  };

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      aria-labelledby="planner-title"
    >
      <div className="mb-7">
        <h1
          id="planner-title"
          className="text-2xl font-semibold tracking-tight"
        >
          Lên lịch trình
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Chọn điểm đến. Sắp xếp chuyến đi theo cách của bạn.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <form
          className="panel space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            generate();
          }}
        >
          <div>
            <label className="field-label" htmlFor="planner-destination">
              Điểm đến
            </label>
            <select
              id="planner-destination"
              className="field"
              value=""
              onChange={(event) => {
                if (!event.target.value) return;
                if (selectedIds.length >= duration) {
                  setError("Tăng số ngày để thêm điểm đến.");
                  return;
                }
                setSelectedIds((previous) => [
                  ...previous,
                  Number(event.target.value),
                ]);
                setError("");
              }}
            >
              <option value="">Thêm tỉnh / thành</option>
              {provinces
                .filter((p) => !selectedIds.includes(p.province_id))
                .map((p) => (
                  <option key={p.province_id} value={p.province_id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <div className="mt-3 space-y-2">
              {selected.map((p, index) => (
                <div
                  key={p.province_id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-teal-50 text-xs text-teal-700">
                    {index + 1}
                  </span>
                  <span className="flex-1">{p.name}</span>
                  <button
                    type="button"
                    aria-label={"Bỏ " + p.name}
                    onClick={() =>
                      setSelectedIds((ids) =>
                        ids.filter((id) => id !== p.province_id),
                      )
                    }
                    className="p-1 text-slate-400"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="planner-duration">
              Thời gian
            </label>
            <select
              id="planner-duration"
              className="field"
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setError("");
              }}
            >
              {durations.map((text, index) => (
                <option
                  key={text}
                  value={index + 1}
                  disabled={index + 1 < selectedIds.length}
                >
                  {text}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">
            <Plus size={16} />
            {itinerary ? "Cập nhật lịch trình" : "Tạo lịch trình"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
        {itinerary ? (
          <div className="space-y-4">
            <div className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{itinerary.title}</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays size={15} />
                    {itinerary.duration}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    onClick={save}
                    disabled={saved}
                  >
                    {saved ? "Đã lưu vào sổ tay" : "Lưu vào sổ tay"}
                  </button>
                  {saved && (
                    <button className="btn-secondary" onClick={onOpenNotebook}>
                      Mở sổ tay
                    </button>
                  )}
                </div>
              </div>
              {saved && (
                <p role="status" className="mt-3 text-sm text-teal-700">
                  Lịch trình đã được lưu.
                </p>
              )}
            </div>
            {itinerary.days.map((day) => (
              <article key={day.day} className="panel overflow-hidden">
                <h3 className="border-b border-slate-100 px-5 py-4 font-semibold">
                  <span className="mr-3 text-teal-700">Ngày {day.day}</span>
                  {day.title}
                </h3>
                <ol className="divide-y divide-slate-100 px-5">
                  {day.activities.map((activity, index) => (
                    <li key={index} className="flex gap-4 py-4">
                      <span className="w-12 shrink-0 text-sm font-medium text-slate-500">
                        {activity.time}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-slate-800">
                          {activity.title}
                        </h4>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} />
                          {activity.location_name}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel flex min-h-96 flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-5 rounded-2xl bg-teal-50 p-4 text-teal-700">
              <CalendarDays size={30} strokeWidth={1.5} />
            </span>
            <h2 className="text-lg font-semibold">Chuyến đi bắt đầu từ đây</h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              Thêm điểm đến và số ngày để xem gợi ý lịch trình.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
