import { useEffect, useState } from "react";
import { Pencil, Plus, MapPin } from "lucide-react";
import {
  placeSchema,
  type ManagedPlace,
  type PlaceInput,
} from "../../shared/places";
import { PROVINCES_34 } from "../../shared/provinces";
import { ApiError, request } from "../services/httpClient";
import Dialog from "../components/ui/Dialog";

const categories = {
  Landmark: "Danh thắng",
  History: "Di tích & văn hóa",
  Geography: "Thiên nhiên",
  Food: "Ẩm thực",
  Festival: "Lễ hội",
};
const seasons = {
  AllYear: "Quanh năm",
  Spring: "Mùa xuân",
  Summer: "Mùa hè",
  Autumn: "Mùa thu",
  Winter: "Mùa đông",
};
const blank = (): PlaceInput => ({
  name: "",
  provinceId: 16,
  category: "Landmark",
  season: "AllYear",
  address: "",
  lat: 21.0285,
  lng: 105.8542,
  description: "",
  article: "",
  imageUrl: "",
});
const inputOf = ({ id, version, ...input }: ManagedPlace): PlaceInput => input;
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Chưa thể hoàn tất yêu cầu.";

export default function AdminPlaces({ onChanged }: { onChanged: () => void }) {
  const [places, setPlaces] = useState<ManagedPlace[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(""),
    [province, setProvince] = useState("");
  const [editor, setEditor] = useState<{
    id?: number;
    version?: number;
    input: PlaceInput;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false),
    [preview, setPreview] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [initial, setInitial] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void request<ManagedPlace[]>("/admin/places", { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setPlaces(rows);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const open = (place?: ManagedPlace) => {
    const input = place ? inputOf(place) : blank();
    setEditor({ id: place?.id, version: place?.version, input });
    setInitial(JSON.stringify(input));
    setError("");
    setNotice("");
    setConflict(false);
    setPreview(false);
    setConfirmClose(false);
  };
  const change = (value: Partial<PlaceInput>) =>
    setEditor((e) => (e ? { ...e, input: { ...e.input, ...value } } : e));
  const close = () => {
    if (busy || !editor) return;
    if (JSON.stringify(editor.input) !== initial) setConfirmClose(true);
    else setEditor(null);
  };
  const visible = places.filter(
    (p) =>
      (!province || p.provinceId === Number(province)) &&
      `${p.name} ${p.address}`
        .toLocaleLowerCase("vi")
        .includes(query.trim().toLocaleLowerCase("vi")),
  );
  return (
    <section className="space-y-4" aria-label="Quản lý địa điểm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Quản lý địa điểm</h2>
          <p className="mt-1 text-sm text-muted">
            Thêm điểm đến và biên tập bài giới thiệu trên bản đồ.
          </p>
        </div>
        <button className="btn-primary" onClick={() => open()}>
          <Plus size={17} />
          Thêm địa điểm
        </button>
      </header>
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-3 text-teal-800">
          {notice}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-red-700">
          {loadError}{" "}
          <button
            className="underline"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Tìm địa điểm
          <input
            className="field mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên hoặc địa chỉ…"
          />
        </label>
        <label className="field-label">
          Lọc tỉnh/thành
          <select
            className="field mt-1"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="">Tất cả tỉnh/thành</option>
            {PROVINCES_34.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Đang tải địa điểm…</p>
      ) : (
        <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
          {!visible.length && (
            <p className="p-5 text-sm text-muted">Không có địa điểm phù hợp.</p>
          )}
          {visible.map((place) => (
            <article
              key={place.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-paper p-4"
            >
              <div className="min-w-0">
                <h3 className="font-semibold">{place.name}</h3>
                <p className="mt-1 text-xs text-muted">
                  {PROVINCES_34.find((p) => p.id === place.provinceId)?.name} ·{" "}
                  {categories[place.category]}
                </p>
              </div>
              <button
                className="btn-secondary shrink-0"
                aria-label={`Sửa ${place.name}`}
                onClick={() => open(place)}
              >
                <Pencil size={15} />
                Sửa
              </button>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <Dialog
          title={editor.id ? "Biên tập địa điểm" : "Thêm địa điểm mới"}
          description="Nội dung lưu thành công sẽ hiển thị công khai trên bản đồ."
          className="!max-w-3xl"
          onClose={close}
        >
          <form
            className="mt-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const parsed = placeSchema.safeParse(editor.input);
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
              setBusy(true);
              setError("");
              setConflict(false);
              try {
                const saved = await request<ManagedPlace>(
                  editor.id ? `/admin/places/${editor.id}` : "/admin/places",
                  {
                    method: editor.id ? "PUT" : "POST",
                    body: editor.id
                      ? { ...parsed.data, version: editor.version }
                      : parsed.data,
                  },
                );
                setPlaces((rows) => [
                  saved,
                  ...rows.filter((p) => p.id !== saved.id),
                ]);
                setEditor(null);
                setNotice(
                  `Đã lưu “${saved.name}”. Nội dung đã xuất hiện trên bản đồ.`,
                );
                onChanged();
              } catch (e) {
                setError(message(e));
                setConflict(e instanceof ApiError && e.status === 409);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
              <label className="field-label">
                Tên địa điểm
                <input
                  className="field mt-1"
                  required
                  minLength={2}
                  maxLength={160}
                  value={editor.input.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-label">
                  Tỉnh/thành
                  <select
                    className="field mt-1"
                    value={editor.input.provinceId}
                    onChange={(e) =>
                      change({ provinceId: Number(e.target.value) })
                    }
                  >
                    {PROVINCES_34.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Danh mục
                  <select
                    className="field mt-1"
                    value={editor.input.category}
                    onChange={(e) =>
                      change({
                        category: e.target.value as PlaceInput["category"],
                      })
                    }
                  >
                    {Object.entries(categories).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field-label">
                Địa chỉ
                <input
                  className="field mt-1"
                  required
                  minLength={3}
                  maxLength={500}
                  value={editor.input.address}
                  onChange={(e) => change({ address: e.target.value })}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="field-label">
                  Vĩ độ
                  <input
                    className="field mt-1"
                    type="number"
                    required
                    min={-90}
                    max={90}
                    step="any"
                    value={
                      Number.isFinite(editor.input.lat) ? editor.input.lat : ""
                    }
                    onChange={(e) => change({ lat: e.target.valueAsNumber })}
                  />
                </label>
                <label className="field-label">
                  Kinh độ
                  <input
                    className="field mt-1"
                    type="number"
                    required
                    min={-180}
                    max={180}
                    step="any"
                    value={
                      Number.isFinite(editor.input.lng) ? editor.input.lng : ""
                    }
                    onChange={(e) => change({ lng: e.target.valueAsNumber })}
                  />
                </label>
                <label className="field-label">
                  Mùa trải nghiệm
                  <select
                    className="field mt-1"
                    value={editor.input.season}
                    onChange={(e) =>
                      change({ season: e.target.value as PlaceInput["season"] })
                    }
                  >
                    {Object.entries(seasons).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={14} />
                Tọa độ quyết định vị trí ghim trên bản đồ; hãy nhập đúng địa
                điểm.
              </p>
              <label className="field-label">
                Ảnh đại diện (liên kết HTTPS, không bắt buộc)
                <input
                  className="field mt-1"
                  type="url"
                  maxLength={2048}
                  value={editor.input.imageUrl}
                  onChange={(e) => change({ imageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="field-label">
                Giới thiệu ngắn
                <textarea
                  className="field mt-1"
                  required
                  minLength={20}
                  maxLength={3000}
                  rows={3}
                  value={editor.input.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </label>
              <label className="field-label">
                Bài mô tả chi tiết
                <textarea
                  className="field mt-1"
                  maxLength={20000}
                  rows={10}
                  value={editor.input.article}
                  onChange={(e) => change({ article: e.target.value })}
                  placeholder="Viết về cảnh quan, lịch sử, trải nghiệm… Xuống dòng để chia đoạn."
                />
              </label>
              <p className="text-right text-xs text-muted">
                {editor.input.article.length.toLocaleString("vi-VN")} / 20.000
                ký tự
              </p>
              <button
                className="btn-secondary"
                type="button"
                aria-expanded={preview}
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? "Ẩn xem trước" : "Xem trước bài giới thiệu"}
              </button>
              {preview && (
                <article className="rounded-xl bg-paper p-5">
                  <h3 className="text-lg font-semibold">
                    {editor.input.name || "Tên địa điểm"}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
                    {editor.input.description}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
                    {editor.input.article}
                  </p>
                </article>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            {conflict && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p>
                  Bản nháp của bạn vẫn được giữ. Sao chép phần cần giữ trước khi
                  tải phiên bản trên máy chủ.
                </p>
                <button
                  type="button"
                  className="mt-2 underline"
                  disabled={busy}
                  onClick={async () => {
                    if (!editor.id) return;
                    setBusy(true);
                    try {
                      const rows =
                        await request<ManagedPlace[]>("/admin/places");
                      const latest = rows.find((p) => p.id === editor.id);
                      if (!latest)
                        throw new Error("Địa điểm không còn tồn tại.");
                      setPlaces(rows);
                      open(latest);
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Bỏ bản nháp này và tải phiên bản mới nhất
                </button>
              </div>
            )}
            {confirmClose && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm">
                <p>Có thay đổi chưa lưu. Bạn muốn bỏ những thay đổi này?</p>
                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setConfirmClose(false)}
                  >
                    Tiếp tục viết
                  </button>
                  <button
                    type="button"
                    className="text-red-700 underline"
                    onClick={() => {
                      setEditor(null);
                      setConfirmClose(false);
                    }}
                  >
                    Bỏ thay đổi và đóng
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn-primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu và công khai"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={close}
              >
                Đóng
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
