import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  Filter,
  LoaderCircle,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { LocationItem, Province, SeasonType } from "../types";
import {
  catalog as apiService,
  fetchVietnamGeoJSON,
} from "../services/catalog";
import { TravelImage, normalizeText } from "./platform/Shared";
import { PROVINCE_SOURCE } from "../../shared/provinces";

interface Props {
  locations?: LocationItem[];
  provinces: Province[];
  onSelectProvince: (p: Province) => void;
  selectedProvinceId?: number;
  visitedProvinceIds: number[];
  focusedLocation?: LocationItem | null;
  onPlanProvince?: (p: Province) => void;
  onSelectLocation?: (p: LocationItem) => void;
  ratings?: Record<number, { average: number; count: number }>;
}
const BOUNDS: L.LatLngBoundsExpression = [
  [8, 102],
  [23.6, 116],
];
const CATEGORIES = [
  ["all", "Tất cả địa điểm"],
  ["attraction", "Danh thắng"],
  ["food", "Ẩm thực"],
  ["history", "Di tích & văn hóa"],
  ["beach", "Bãi biển"],
  ["nature", "Núi & thiên nhiên"],
] as const;
const COLORS: Record<string, string> = {
  attraction: "#176b45",
  food: "#d94f3d",
  history: "#946829",
  beach: "#087e8b",
  nature: "#486c36",
};
const ICONS: Record<string, string> = {
  food: "M4 3v6m3-6v6m3-6v6M4 6h6M7 9v12M19 3c-4 3-4 8 0 8v10M19 3v8",
  history: "M3 9h18M4 9V7l8-4 8 4v2M6 10v9m6-9v9m6-9v9M3 21h18",
  beach:
    "M3 12a9 9 0 0 1 18 0H3m9-9c-4 4-4 9 0 9m0-9c4 4 4 9 0 9m0 0v9m-6 0h12",
  nature: "M2 20 9 5l5 9 3-6 5 12H2m4-9 3 2 3-2",
  attraction: "M12 3a7 7 0 0 0-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 0 0-7-7Z",
};
const SEASONS: [SeasonType, string][] = [
  ["AllYear", "Mọi mùa"],
  ["Spring", "Mùa xuân"],
  ["Summer", "Mùa hè"],
  ["Autumn", "Mùa thu"],
  ["Winter", "Mùa đông"],
];
const regionOf = (p?: Province) =>
  p?.region === "Bac" ? "Bắc" : p?.region === "TayNguyen" ? "Trung" : p?.region;
const kind = (p: LocationItem) =>
  p.category === "Food"
    ? "food"
    : p.category === "History" || p.category === "Festival"
      ? "history"
      : /bai bien|bai sao|bai sau|bai truoc|ky co|eo gio|vinh nha trang|vinh ha long|vinh lan ha|dao hon mun|ly son/i.test(
            normalizeText(p.name),
          )
        ? "beach"
        : p.category === "Geography"
          ? "nature"
          : "attraction";
const domText = (text: string) => {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
};
const EMPTY = {};
const DEFAULT_LOCATIONS = apiService.getLocations();
export function VietnamMap({
  locations = DEFAULT_LOCATIONS,
  provinces,
  onSelectProvince,
  selectedProvinceId,
  visitedProvinceIds,
  focusedLocation,
  onPlanProvince,
  onSelectLocation,
  ratings = EMPTY,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null),
    tilesRef = useRef<L.TileLayer | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const polygonRef = useRef<L.GeoJSON | null>(null),
    bounds = useRef(new Map<number, L.LatLngBounds>()),
    markerRef = useRef(new Map<number, L.Marker>());
  const callbacks = useRef({ onSelectProvince, onSelectLocation });
  callbacks.current = { onSelectProvince, onSelectLocation };
  const [geo, setGeo] = useState<FeatureCollection | null>(null),
    [geoError, setGeoError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [tileState, setTileState] = useState("loading");
  const [query, setQuery] = useState(""),
    [region, setRegion] = useState(""),
    [category, setCategory] = useState("all"),
    [season, setSeason] = useState("AllYear"),
    [rating, setRating] = useState(0);
  const [mode, setMode] = useState<"places" | "provinces">("provinces"),
    [open, setOpen] = useState(false),
    [activeId, setActiveId] = useState<number>();
  const lookup = useMemo(
    () => new Map(provinces.map((p) => [p.province_id, p])),
    [provinces],
  );
  const search = normalizeText(query);
  const filtered = useMemo(
    () =>
      locations.filter(
        (p) =>
          (!search ||
            normalizeText(
              p.name +
                " " +
                p.address +
                " " +
                lookup.get(p.province_id)?.name +
                " " +
                (lookup.get(p.province_id)?.previous_names || []).join(" "),
            ).includes(search)) &&
          (!region || regionOf(lookup.get(p.province_id)) === region) &&
          (category === "all" || kind(p) === category) &&
          (season === "AllYear" ||
            p.season === "AllYear" ||
            p.season === season) &&
          (!rating ||
            (ratings[p.location_id]?.count > 0 &&
              ratings[p.location_id].average >= rating)),
      ),
    [locations, lookup, search, region, category, season, rating, ratings],
  );
  const provinceIds = useMemo(
    () => new Set(filtered.map((p) => p.province_id)),
    [filtered],
  );
  const visibleProvinces = useMemo(
    () =>
      provinces
        .filter(
          (p) =>
            (!region || regionOf(p) === region) &&
            (!search ||
              normalizeText(
                [p.name, ...(p.previous_names || [])].join(" "),
              ).includes(search) ||
              provinceIds.has(p.province_id)) &&
            ((category === "all" && season === "AllYear" && !rating) ||
              provinceIds.has(p.province_id)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [provinces, region, search, provinceIds, category, season, rating],
  );
  const visibleIds = new Set(visibleProvinces.map((p) => p.province_id));
  const styleRef = useRef<(id: number) => L.PathOptions>(() => ({}));
  styleRef.current = (id) => ({
    color: id === selectedProvinceId ? "#164932" : "#627368",
    weight: id === selectedProvinceId ? 2.5 : 0.9,
    fillColor:
      id === selectedProvinceId
        ? "#176b45"
        : visitedProvinceIds.includes(id)
          ? "#087e8b"
          : regionOf(lookup.get(id)) === "Bắc"
            ? "#8bb996"
            : regionOf(lookup.get(id)) === "Trung"
              ? "#80b8af"
              : "#abc484",
    fillOpacity: visibleIds.has(id) ? 0.78 : 0.14,
    opacity: 1,
  });
  const startTiles = () => {
    const map = mapRef.current;
    if (!map) return;
    clearTimeout(timer.current);
    tilesRef.current?.remove();
    let failures = 0;
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 2,
      },
    );
    tilesRef.current = layer;
    const fail = () => {
      if (tilesRef.current !== layer) return;
      clearTimeout(timer.current);
      layer.remove();
      tilesRef.current = null;
      setTileState("error");
    };
    layer.on("loading", () => {
      setTileState("loading");
      clearTimeout(timer.current);
      timer.current = setTimeout(fail, 15000);
    });
    layer.on("load", () => {
      if (tilesRef.current === layer) {
        clearTimeout(timer.current);
        setTileState(failures ? "partial" : "ready");
      }
    });
    layer.on("tileerror", () => {
      failures++;
      if (failures >= 3) fail();
      else setTileState("partial");
    });
    layer.addTo(map);
  };
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      zoomControl: false,
      zoomSnap: 0.25,
      minZoom: 3,
      maxZoom: 17,
      maxBounds: [
        [5, 99],
        [26, 119],
      ],
      maxBoundsViscosity: 0.8,
      preferCanvas: true,
    });
    mapRef.current = map;
    map.fitBounds(BOUNDS, { padding: [20, 24], animate: false });
    startTiles();
    [
      [[16.4, 112.2], "Hoàng Sa (Việt Nam)"],
      [[10.2, 114.4], "Trường Sa (Việt Nam)"],
    ].forEach(([point, name]) => {
      const el = domText(name as string);
      el.className = "vn-island-chip";
      L.marker(point as L.LatLngTuple, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          html: el,
          className: "vn-island-label",
          iconSize: [145, 24],
          iconAnchor: [70, 12],
        }),
      }).addTo(map);
    });
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ pan: false }),
    );
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
      tilesRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setGeoError(false);
    fetchVietnamGeoJSON()
      .then((data) => {
        if (active) setGeo(data);
      })
      .catch(() => {
        if (active) setGeoError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo) return;
    bounds.current.clear();
    const layer = L.geoJSON(geo, {
      style: (f) => styleRef.current(Number(f?.properties?.id)),
      onEachFeature: (feature, path) => {
        const id = Number(feature.properties?.id),
          p = lookup.get(id);
        if (!p) return;
        if (path instanceof L.Polygon) bounds.current.set(id, path.getBounds());
        path.bindTooltip(domText(p.name), { sticky: true });
        path.on({
          click: () => {
            callbacks.current.onSelectProvince(p);
            setOpen(false);
          },
          mouseover: () => {
            if (path instanceof L.Path) {
              path.setStyle({ weight: 2.5, fillOpacity: 0.95 });
              path.bringToFront();
            }
          },
          mouseout: () => {
            if (path instanceof L.Path) path.setStyle(styleRef.current(id));
          },
        });
      },
    }).addTo(map);
    polygonRef.current = layer;
    return () => {
      layer.remove();
      polygonRef.current = null;
    };
  }, [geo, lookup]);
  useEffect(() => {
    polygonRef.current?.setStyle((f) =>
      styleRef.current(Number(f?.properties?.id)),
    );
  }, [selectedProvinceId, visitedProvinceIds, visibleProvinces, geo]);
  useEffect(() => {
    if (selectedProvinceId === undefined || focusedLocation) return;
    const b = bounds.current.get(selectedProvinceId);
    if (b?.isValid())
      mapRef.current?.fitBounds(b, { padding: [32, 32], maxZoom: 9 });
  }, [selectedProvinceId, geo, focusedLocation]);
  const pin = (p: LocationItem, selected = false) =>
    L.divIcon({
      className: "vn-marker",
      html: `<span style="background:${COLORS[kind(p)]}" class="vn-marker-dot ${selected ? "selected" : ""}"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="${ICONS[kind(p)]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`,
      iconSize: [29, 29],
      iconAnchor: [14, 14],
    });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "places") return;
    const group = L.layerGroup().addTo(map);
    markerRef.current.clear();
    filtered.forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      const marker = L.marker([p.lat, p.lng], {
        icon: pin(p, p.location_id === activeId),
        title: p.name,
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(domText(p.name))
        .on("click", () => {
          setActiveId(p.location_id);
          setOpen(false);
          callbacks.current.onSelectLocation?.(p);
        })
        .addTo(group);
      markerRef.current.set(p.location_id, marker);
    });
    return () => {
      group.remove();
      markerRef.current.clear();
    };
  }, [filtered, mode]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "provinces") return;
    const group = L.layerGroup().addTo(map);
    visibleProvinces.forEach((p) => {
      const label = domText(p.name);
      label.className =
        "rounded-md border border-white bg-brand px-2 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap";
      L.marker([p.lat, p.lng], {
        title: p.name,
        icon: L.divIcon({
          html: label,
          className: "vn-province-marker",
          iconSize: [100, 28],
          iconAnchor: [50, 14],
        }),
      })
        .on("click", () => callbacks.current.onSelectProvince(p))
        .addTo(group);
    });
    return () => {
      group.remove();
    };
  }, [mode, visibleProvinces]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngTuple[] = (
      mode === "places" ? filtered : visibleProvinces
    )
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lat, p.lng]);
    const timeout = setTimeout(() => {
      if (
        !region &&
        !search &&
        category === "all" &&
        season === "AllYear" &&
        !rating
      )
        map.fitBounds(BOUNDS, { padding: [20, 24], animate: false });
      else if (points.length) {
        const target = L.latLngBounds(points);
        if (mode === "provinces") {
          visibleProvinces.forEach((p) => {
            const boundary = bounds.current.get(p.province_id);
            if (boundary?.isValid()) target.extend(boundary);
          });
        }
        map.fitBounds(target, {
          padding: [40, 40],
          maxZoom: 10,
          animate: false,
        });
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [
    filtered,
    visibleProvinces,
    mode,
    region,
    search,
    category,
    season,
    rating,
    geo,
  ]);
  useEffect(() => {
    filtered.forEach((p) =>
      markerRef.current
        .get(p.location_id)
        ?.setIcon(pin(p, p.location_id === activeId)),
    );
  }, [activeId, filtered]);
  useEffect(() => {
    if (!focusedLocation) return;
    setActiveId(focusedLocation.location_id);
    mapRef.current?.flyTo([focusedLocation.lat, focusedLocation.lng], 11, {
      duration: 0.6,
    });
  }, [focusedLocation]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const clear = () => {
    setQuery("");
    setRegion("");
    setCategory("all");
    setSeason("AllYear");
    setRating(0);
  };
  const selectPlace = (p: LocationItem) => {
    setActiveId(p.location_id);
    setOpen(false);
    mapRef.current?.flyTo([p.lat, p.lng], 11, { duration: 0.6 });
    onSelectLocation?.(p);
  };
  return (
    <section aria-label="Bản đồ và khám phá" className="vn-explore">
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          <p className="page-eyebrow">
            <Compass size={15} /> Mỗi vùng đất, một câu chuyện
          </p>
          <h1 className="page-title">Việt Nam, từng điểm đến.</h1>
          <p className="page-lead !mt-2">
            Chạm vào bản đồ. Tìm cảm hứng cho chuyến đi tiếp theo.
          </p>
        </div>
        <span className="badge-label hidden shrink-0 !py-2 lg:flex">
          {provinces.length} tỉnh/thành · Sau sáp nhập 2025
        </span>
      </div>
      <div className="explore-grid">
        <aside
          className={`explore-sidebar ${open ? "is-open" : ""}`}
          aria-label="Tìm kiếm và bộ lọc"
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-sm font-bold">Bạn muốn khám phá đâu?</h2>
            <button
              className="icon-button !size-8 md:!hidden"
              aria-label="Đóng bộ lọc"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 p-5 pb-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-3.5 text-muted"
              />
              <input
                className="field !bg-paper !pl-9"
                type="search"
                aria-label="Tìm địa điểm hoặc tỉnh thành"
                placeholder="Hà Giang, Hội An, món ngon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {["", "Bắc", "Trung", "Nam"].map((r) => (
                <button
                  key={r}
                  className={`flex-1 rounded-md px-1 py-2 text-[11px] font-semibold ${region === r ? "bg-brand text-white" : "bg-paper text-muted"}`}
                  aria-pressed={region === r}
                  onClick={() => setRegion(r)}
                >
                  {r ? "Miền " + r : "Cả nước"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-muted">
                Trải nghiệm
                <select
                  className="field mt-1 !px-2 !text-xs"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-muted">
                Mùa du lịch
                <select
                  className="field mt-1 !px-2 !text-xs"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                >
                  {SEASONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-[11px] font-semibold text-muted">
              Đánh giá cộng đồng
              <select
                className="field mt-1 !text-xs"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                <option value={0}>Tất cả, gồm nơi chưa có đánh giá</option>
                <option value={3}>Từ 3 sao</option>
                <option value={4}>Từ 4 sao</option>
                <option value={4.5}>Từ 4,5 sao</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 border-y border-slate-100 px-5">
            {[
              ["places", "Điểm đến"],
              ["provinces", "Tỉnh / thành"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                onClick={() => setMode(id as typeof mode)}
                className={`border-b-2 py-3 text-xs font-bold ${mode === id ? "border-brand text-brand" : "border-transparent text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-3 text-[11px]">
            <p aria-live="polite" className="font-semibold">
              {mode === "places" ? filtered.length : visibleProvinces.length}{" "}
              kết quả
            </p>
            <button className="text-brand hover:underline" onClick={clear}>
              Xóa bộ lọc
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
            {mode === "places"
              ? filtered.map((p) => (
                  <button
                    key={p.location_id}
                    onClick={() => selectPlace(p)}
                    aria-pressed={activeId === p.location_id}
                    className={`flex w-full items-center gap-3 rounded-xl border-b border-slate-100 p-2.5 text-left hover:bg-paper ${activeId === p.location_id ? "bg-teal-50" : ""}`}
                  >
                    <TravelImage
                      src={p.image_url}
                      alt=""
                      className="h-[72px] w-16 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-brand">
                        {CATEGORIES.find(([id]) => id === kind(p))?.[1]}
                      </span>
                      <strong className="mt-0.5 block text-xs leading-5">
                        {p.name}
                      </strong>
                      <span className="mt-1 block text-[10px] text-muted">
                        {lookup.get(p.province_id)?.name}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted">
                        {ratings[p.location_id]?.count
                          ? `★ ${ratings[p.location_id].average.toFixed(1)} · ${ratings[p.location_id].count} đánh giá`
                          : "Chưa có đánh giá"}
                      </span>
                    </span>
                    <ArrowUpRight size={15} className="shrink-0 text-brand" />
                  </button>
                ))
              : visibleProvinces.map((p) => (
                  <div
                    key={p.province_id}
                    className="rounded-lg border-b border-slate-100 p-2 hover:bg-paper"
                  >
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => {
                        onSelectProvince(p);
                        setOpen(false);
                      }}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand">
                        {visitedProvinceIds.includes(p.province_id) ? (
                          <Check size={19} />
                        ) : (
                          <MapPin size={19} />
                        )}
                      </span>
                      <span>
                        <strong className="block text-sm">{p.name}</strong>
                        <span className="mt-1 block text-xs text-muted">
                          Miền {regionOf(p)}
                        </span>
                      </span>
                    </button>
                    {onPlanProvince && (
                      <button
                        onClick={() => onPlanProvince(p)}
                        className="ml-[52px] mt-2 text-[11px] font-semibold text-brand"
                      >
                        Xem lịch trình tại đây ↗
                      </button>
                    )}
                  </div>
                ))}
            {!(mode === "places" ? filtered : visibleProvinces).length && (
              <div className="empty-state !border-0 !py-8">
                <MapPin size={27} />
                <p>Chưa có địa điểm phù hợp.</p>
                <button className="subtle-link" onClick={clear}>
                  Mở rộng tìm kiếm
                </button>
              </div>
            )}
          </div>
        </aside>
        <div className="relative isolate h-full min-w-0">
          <div
            ref={container}
            className="absolute inset-0 z-0"
            role="region"
            aria-label="Bản đồ tương tác Việt Nam. Có thể dùng danh sách điểm đến bằng bàn phím."
          />
          <button
            className="absolute right-4 top-4 z-[400] flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-brand shadow-sm"
            onClick={() =>
              mapRef.current?.fitBounds(BOUNDS, { padding: [20, 24] })
            }
          >
            <Maximize2 size={15} />
            Toàn cảnh Việt Nam
          </button>
          <div className="absolute bottom-9 right-4 z-[400] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button
              className="block border-b border-slate-100 p-2.5"
              aria-label="Phóng to"
              onClick={() => mapRef.current?.zoomIn()}
            >
              <Plus size={19} />
            </button>
            <button
              className="block p-2.5"
              aria-label="Thu nhỏ"
              onClick={() => mapRef.current?.zoomOut()}
            >
              <Minus size={19} />
            </button>
          </div>
          {(tileState === "error" || tileState === "partial" || geoError) && (
            <div
              role="status"
              className="absolute left-3 top-16 z-[400] max-w-[min(320px,calc(100%-24px))] rounded-xl border border-[#dfd1a6] bg-[#fffbef] p-3 text-xs leading-5"
            >
              <p>
                {geoError
                  ? "Chưa tải được ranh giới địa phương."
                  : "Nền bản đồ chưa tải đầy đủ. Ranh giới và điểm đến vẫn dùng được."}
              </p>
              <button
                className="mt-1 font-bold text-brand underline"
                onClick={() =>
                  geoError ? setAttempt(attempt + 1) : startTiles()
                }
              >
                Thử lại
              </button>
            </div>
          )}
          {!geo && !geoError && (
            <span className="absolute left-3 top-4 z-[400] flex items-center gap-2 rounded-lg bg-white p-2 text-xs">
              <LoaderCircle size={15} className="animate-spin" />
              Đang tải bản đồ…
            </span>
          )}
          <div className="explore-legend absolute bottom-8 left-4 z-[400] rounded-lg border border-slate-200 bg-white/95 p-3 text-[10px] text-muted">
            <p className="mb-2 font-semibold text-ink">
              Khám phá theo cách của bạn
            </p>
            <div className="flex flex-wrap gap-3">
              <span>
                <i className="mr-1.5 inline-block size-2 rounded-sm bg-brand" />
                Đang chọn
              </span>
              <span>
                <i className="mr-1.5 inline-block size-2 rounded-sm bg-ocean" />
                Đã ghé thăm
              </span>
            </div>
          </div>
          <button
            className="explore-mobile-toggle btn-primary absolute bottom-7 left-1/2 z-[450] -translate-x-1/2 whitespace-nowrap !rounded-full shadow-md"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Filter size={16} />
            Tìm kiếm & bộ lọc{" "}
            <span className="rounded-full bg-white px-2 text-xs text-brand">
              {filtered.length}
            </span>
          </button>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">
        Danh mục 34 tỉnh/thành từ 01/07/2025 theo{" "}
        <a
          href={PROVINCE_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Nghị quyết 202/2025/QH15
        </a>
        . Ranh giới minh họa được gộp từ dữ liệu bản đồ gốc. Nhãn quần đảo là vị
        trí tham khảo; GeoJSON chưa bao phủ đầy đủ các đảo ngoài khơi. Điểm sao
        chỉ tính từ đánh giá cộng đồng đã lưu.
      </p>
    </section>
  );
}
