import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import {
  itinerarySchema,
  savedDraftSchema,
  type ActivityInput,
  type ItineraryInput,
  type TravelPlan,
} from "../../shared/travel";
import { request } from "../services/httpClient";
import { useAuth } from "./auth";
import { usePagedResource } from "./usePagedResource";
import Dialog from "../components/ui/Dialog";
import { currentProvinceName, PROVINCES_34 } from "../../shared/provinces";
import { ItineraryExamples } from "./TravelExamples";

const blankActivity = (): ActivityInput => ({
  time: "08:00",
  endTime: "09:00",
  title: "",
  place: "",
  notes: "",
  cost: 0,
});
const blankPlan = (province: string): ItineraryInput => ({
  title: "",
  description: "",
  province,
  visibility: "PRIVATE",
  days: [{ title: "Khám phá điểm đến", activities: [blankActivity()] }],
});
function inputOf(plan: TravelPlan): ItineraryInput {
  return {
    title: plan.title,
    description: plan.description,
    province: currentProvinceName(plan.province),
    visibility: plan.visibility,
    days: plan.days.map((d) => ({
      title: d.title,
      activities: d.activities.map((a) => ({
        time: a.time,
        endTime: a.endTime,
        title: a.title,
        place: a.place,
        notes: a.notes,
        cost: a.cost,
      })),
    })),
  };
}
const money = (value: number) => value.toLocaleString("vi-VN") + " ₫";
interface Editor {
  id: string;
  version?: number;
  input: ItineraryInput;
}
export function ItineraryPlanner({
  notebook = false,
  province = "",
  sharedId,
  onSignIn,
}: {
  notebook?: boolean;
  province?: string;
  sharedId?: string;
  onSignIn: () => void;
}) {
  const { user, refresh } = useAuth(),
    [mine, setMine] = useState(notebook),
    [editor, setEditor] = useState<Editor | null>(null),
    [detail, setDetail] = useState<TravelPlan | null>(null),
    [deleting, setDeleting] = useState<TravelPlan | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [shareLink, setShareLink] = useState("");
  const plans = usePagedResource<TravelPlan>(
    mine && !user ? null : `/v1/itineraries${mine ? "?mine=true" : ""}`,
  );
  const draftKey = `vntravel.plan.v2:${user?.id || "guest"}`;
  const [pendingExample, setPendingExample] = useState<ItineraryInput | null>(
    null,
  );
  const copyExample = (input: ItineraryInput, replace = false) => {
    if (!user) {
      onSignIn();
      return;
    }
    if (!replace) {
      try {
        const saved = savedDraftSchema.safeParse(
          JSON.parse(sessionStorage.getItem(draftKey) || "null"),
        );
        if (saved.success) {
          setPendingExample(input);
          return;
        }
      } catch {
        /* Invalid or unavailable storage does not prevent using an example. */
      }
    }
    setPendingExample(null);
    setError("");
    setDetail(null);
    setEditor({
      id: crypto.randomUUID(),
      input: { ...structuredClone(input), visibility: "PRIVATE" },
    });
    setNotice(
      "Đã sao chép mẫu vào bản nháp riêng. Bạn có thể chỉnh sửa trước khi lưu.",
    );
  };
  useEffect(() => {
    if (!sharedId) return;
    const controller = new AbortController();
    void request<TravelPlan>(
      `/v1/itineraries/${encodeURIComponent(sharedId)}`,
      { signal: controller.signal },
    )
      .then(setDetail)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [sharedId]);
  useEffect(() => {
    if (!editor) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(editor));
    } catch {
      /* The editor remains usable when browser storage is unavailable. */
    }
  }, [editor, draftKey]);
  const start = () => {
    if (!user) {
      onSignIn();
      return;
    }
    let restored: Editor | null = null;
    try {
      const parsed = savedDraftSchema.safeParse(
        JSON.parse(sessionStorage.getItem(draftKey) || "null"),
      );
      if (parsed.success) restored = parsed.data;
    } catch {
      /* Ignore an invalid local draft; server data is unaffected. */
    }
    setError("");
    setEditor(
      restored || { id: crypto.randomUUID(), input: blankPlan(province) },
    );
  };
  const update = (change: Partial<ItineraryInput>) =>
    setEditor((e) => (e ? { ...e, input: { ...e.input, ...change } } : e));
  const dayChange = (
    index: number,
    change: Partial<ItineraryInput["days"][number]>,
  ) => {
    if (editor)
      update({
        days: editor.input.days.map((d, i) =>
          i === index ? { ...d, ...change } : d,
        ),
      });
  };
  const activityChange = (
    day: number,
    index: number,
    change: Partial<ActivityInput>,
  ) => {
    if (editor)
      dayChange(day, {
        activities: editor.input.days[day].activities.map((a, i) =>
          i === index ? { ...a, ...change } : a,
        ),
      });
  };
  const share = async (plan: TravelPlan) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("tab", "planner");
    url.searchParams.set("plan", plan.id);
    setShareLink(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice("Đã sao chép liên kết công khai.");
    } catch {
      setNotice("Sao chép liên kết bên dưới để chia sẻ.");
    }
  };
  return (
    <section className="page-shell max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {notebook ? "Sổ tay hành trình" : "Lên lịch trình"}
          </h1>
          <p className="page-lead">
            Sắp xếp chuyến đi theo từng ngày và khung giờ.
          </p>
        </div>
        <button className="btn-primary" onClick={start}>
          <Plus size={18} />
          Tạo / tiếp tục bản nháp
        </button>
      </header>
      {!notebook && (
        <ItineraryExamples onCopy={(input) => copyExample(input)} />
      )}
      <div className="mb-5 flex gap-2">
        <button
          className={`chip ${mine ? "chip-active" : ""}`}
          aria-pressed={mine}
          onClick={() => setMine(true)}
        >
          Lịch trình của tôi
        </button>
        <button
          className={`chip ${!mine ? "chip-active" : ""}`}
          aria-pressed={!mine}
          onClick={() => setMine(false)}
        >
          Khám phá công khai
        </button>
      </div>
      {(error || plans.error) && (
        <p role="alert" className="my-4 text-red-700">
          {error || plans.error}{" "}
          <button className="subtle-link" onClick={() => void plans.reload()}>
            Tải lại danh sách
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 text-brand">
          {notice}
        </p>
      )}
      {shareLink && (
        <input
          className="field mb-4"
          aria-label="Liên kết công khai"
          readOnly
          value={shareLink}
          onFocus={(e) => e.target.select()}
        />
      )}
      {mine && !user && (
        <div className="empty-state">
          <p>Đăng nhập để xem và lưu lịch trình trên tài khoản.</p>
          <button className="btn-primary" onClick={onSignIn}>
            Đăng nhập
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.items.map((plan) => (
          <article key={plan.id} className="panel p-5">
            <p className="text-xs text-muted">
              {currentProvinceName(plan.province)} · {plan.days.length} ngày ·{" "}
              {plan.visibility === "PUBLIC" ? "Công khai" : "Riêng tư"}
            </p>
            <h2 className="my-3 text-lg font-semibold">{plan.title}</h2>
            <p className="line-clamp-3 text-sm text-muted">
              {plan.description}
            </p>
            <p className="mt-3 text-xs text-muted">
              {plan.author.name} ·{" "}
              {money(
                plan.days.reduce(
                  (sum, d) =>
                    sum + d.activities.reduce((total, a) => total + a.cost, 0),
                  0,
                ),
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="subtle-link" onClick={() => setDetail(plan)}>
                Xem lịch trình
              </button>
              {plan.visibility === "PUBLIC" && (
                <button
                  className="subtle-link"
                  onClick={() => void share(plan)}
                >
                  Chia sẻ
                </button>
              )}
              {user?.id === plan.authorId && (
                <>
                  <button
                    className="subtle-link"
                    onClick={() => {
                      setEditor({
                        id: plan.id,
                        version: plan.version,
                        input: inputOf(plan),
                      });
                      setError("");
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    className="text-sm text-accent"
                    onClick={() => {
                      setDeleting(plan);
                      setError("");
                    }}
                  >
                    Xóa
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {plans.loading && (
        <p role="status" className="p-5">
          Đang tải lịch trình…
        </p>
      )}
      {!plans.loading &&
        !plans.error &&
        !plans.items.length &&
        (!mine || user) && (
          <p className="empty-state">
            Chưa có lịch trình. Bắt đầu chuyến đi của bạn!
          </p>
        )}
      {plans.hasMore && (
        <button
          className="btn-secondary mt-5"
          disabled={plans.loading}
          onClick={() => void plans.more()}
        >
          Xem thêm
        </button>
      )}
      {pendingExample && (
        <Dialog
          title="Bạn đang có bản nháp chưa lưu"
          onClose={() => setPendingExample(null)}
        >
          <p className="my-4 text-sm leading-6 text-muted">
            Dùng mẫu mới sẽ thay thế bản nháp trên trình duyệt. Lịch trình đã
            lưu trên tài khoản không bị thay đổi.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              onClick={() => {
                setPendingExample(null);
                start();
              }}
            >
              Tiếp tục bản nháp cũ
            </button>
            <button
              className="btn-secondary"
              onClick={() => copyExample(pendingExample, true)}
            >
              Thay bản nháp bằng mẫu này
            </button>
          </div>
        </Dialog>
      )}
      {editor && (
        <Dialog
          title={editor.version ? "Chỉnh sửa hành trình" : "Hành trình mới"}
          className="!max-w-4xl"
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="mt-5 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const parsed = itinerarySchema.safeParse(editor.input);
              if (!parsed.success) {
                setError(
                  parsed.error.issues
                    .map((i) => `${i.path.join(".")}: ${i.message}`)
                    .join(" · "),
                );
                return;
              }
              setBusy(true);
              setError("");
              try {
                await request<TravelPlan>(
                  editor.version
                    ? `/v1/itineraries/${editor.id}`
                    : "/v1/itineraries",
                  {
                    method: editor.version ? "PUT" : "POST",
                    body: {
                      ...parsed.data,
                      ...(editor.version
                        ? { version: editor.version }
                        : { id: editor.id }),
                    },
                  },
                );
                try {
                  sessionStorage.removeItem(draftKey);
                } catch {
                  /* Server save has already succeeded. */
                }
                setEditor(null);
                setNotice("Đã lưu hành trình vào tài khoản.");
                if (editor.input.visibility === "PRIVATE" && !mine)
                  setMine(true);
                else await plans.reload();
                await refresh();
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Không thể lưu hành trình.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="space-y-5">
              <div className="form-grid">
                <label>
                  Tên hành trình
                  <input
                    className="field"
                    required
                    minLength={3}
                    maxLength={140}
                    value={editor.input.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>
                  Tỉnh / thành hoặc tuyến đi
                  <input
                    className="field"
                    required
                    maxLength={100}
                    list="itinerary-provinces-34"
                    value={editor.input.province}
                    onChange={(e) => update({ province: e.target.value })}
                  />
                </label>
              </div>
              <datalist id="itinerary-provinces-34">
                {PROVINCES_34.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <label className="field-label">
                Mô tả
                <textarea
                  className="field mt-1"
                  maxLength={5000}
                  value={editor.input.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </label>
              <label className="field-label">
                Chế độ lưu
                <select
                  className="field mt-1"
                  value={editor.input.visibility}
                  onChange={(e) =>
                    update({
                      visibility: e.target
                        .value as ItineraryInput["visibility"],
                    })
                  }
                >
                  <option value="PRIVATE">Riêng tư · chỉ mình tôi</option>
                  <option value="PUBLIC">
                    Công khai · mọi người có thể xem
                  </option>
                </select>
              </label>
              {editor.input.days.map((day, dayIndex) => (
                <section
                  key={dayIndex}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-bold">
                      <CalendarDays size={18} />
                      Ngày {dayIndex + 1}
                    </h3>
                    <button
                      type="button"
                      className="text-sm text-accent"
                      disabled={editor.input.days.length === 1}
                      onClick={() =>
                        update({
                          days: editor.input.days.filter(
                            (_, i) => i !== dayIndex,
                          ),
                        })
                      }
                    >
                      Xóa ngày
                    </button>
                  </div>
                  <label className="field-label">
                    Chủ đề ngày
                    <input
                      className="field mt-1"
                      required
                      maxLength={120}
                      value={day.title}
                      onChange={(e) =>
                        dayChange(dayIndex, { title: e.target.value })
                      }
                    />
                  </label>
                  {day.activities.map((activity, index) => (
                    <div
                      key={index}
                      className="my-4 space-y-3 rounded-lg bg-paper p-3"
                    >
                      <div className="form-grid">
                        <label>
                          Bắt đầu
                          <input
                            className="field"
                            type="time"
                            required
                            value={activity.time}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                time: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Kết thúc
                          <input
                            className="field"
                            type="time"
                            required
                            value={activity.endTime}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                endTime: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Hoạt động
                          <input
                            className="field"
                            required
                            minLength={2}
                            maxLength={160}
                            value={activity.title}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                title: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Địa điểm
                          <input
                            className="field"
                            maxLength={160}
                            value={activity.place}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                place: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Chi phí (VND)
                          <input
                            className="field"
                            type="number"
                            min={0}
                            max={1000000000}
                            step={1}
                            value={activity.cost}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                cost: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Ghi chú
                          <input
                            className="field"
                            maxLength={2000}
                            value={activity.notes}
                            onChange={(e) =>
                              activityChange(dayIndex, index, {
                                notes: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-accent"
                        disabled={day.activities.length === 1}
                        onClick={() =>
                          dayChange(dayIndex, {
                            activities: day.activities.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                        Xóa hoạt động
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={day.activities.length >= 20}
                    onClick={() => {
                      const last = day.activities.at(-1)!,
                        start = last.endTime,
                        hour = Number(start.slice(0, 2));
                      dayChange(dayIndex, {
                        activities: [
                          ...day.activities,
                          {
                            ...blankActivity(),
                            time: start,
                            endTime:
                              hour < 23
                                ? `${String(hour + 1).padStart(2, "0")}:${start.slice(3)}`
                                : "23:59",
                          },
                        ],
                      });
                    }}
                  >
                    Thêm khung giờ
                  </button>
                </section>
              ))}
              <button
                type="button"
                className="btn-secondary"
                disabled={editor.input.days.length >= 30}
                onClick={() =>
                  update({
                    days: [
                      ...editor.input.days,
                      {
                        title: `Khám phá ngày ${editor.input.days.length + 1}`,
                        activities: [blankActivity()],
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Thêm ngày
              </button>
              <p className="font-semibold">
                Tổng dự kiến:{" "}
                {money(
                  editor.input.days.reduce(
                    (sum, d) =>
                      sum +
                      d.activities.reduce((total, a) => total + a.cost, 0),
                    0,
                  ),
                )}
              </p>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary">
                  {busy
                    ? "Đang lưu…"
                    : editor.input.visibility === "PUBLIC"
                      ? "Lưu và công khai"
                      : "Lưu vào sổ tay"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem(draftKey);
                    } catch {
                      /* Local draft may already be absent. */
                    }
                    setEditor(null);
                  }}
                >
                  Bỏ bản nháp
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
      {detail && (
        <Dialog
          title={detail.title}
          description={`${currentProvinceName(detail.province)} · ${detail.author.name}`}
          className="!max-w-3xl"
          onClose={() => setDetail(null)}
        >
          <p className="prose-travel mt-4">{detail.description}</p>
          {detail.days.map((day, i) => (
            <section key={i} className="mt-6">
              <h3 className="font-bold">
                Ngày {i + 1} · {day.title}
              </h3>
              <ol className="mt-4 space-y-4 border-l-2 border-teal-100 pl-4">
                {day.activities.map((a, index) => (
                  <li key={index}>
                    <p className="text-xs font-semibold text-brand">
                      {a.time}–{a.endTime}
                    </p>
                    <h4 className="mt-1 font-semibold">{a.title}</h4>
                    <p className="text-sm text-muted">
                      {a.place} · {money(a.cost)}
                    </p>
                    <p className="prose-travel text-sm">{a.notes}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Xóa lịch trình này?"
          description="Lịch trình sẽ bị xóa khỏi tài khoản và liên kết công khai."
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="mt-5 flex gap-3">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Giữ lại
            </button>
            <button
              className="btn-primary !bg-accent"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await request(
                    `/v1/itineraries/${deleting.id}?version=${deleting.version}`,
                    { method: "DELETE" },
                  );
                  setDeleting(null);
                  await plans.reload();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Không thể xóa.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Xóa lịch trình
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-red-700">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </section>
  );
}
