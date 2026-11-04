import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Header, type AppTab } from "./components/Header";
import Dialog from "./components/ui/Dialog";
import { catalog, locationFromManaged } from "./services/catalog";
import type { ManagedPlace } from "../shared/places";
import { request } from "./services/httpClient";
import {
  AuthProvider,
  SignInDialog,
  useAuth,
  type AuthMode,
} from "./features/auth";
import type { LocationItem, Province, User } from "./types";
import { tierFor } from "../shared/travel";
const AdminDashboard = lazy(() => import("./features/AdminDashboard"));
const VietnamMap = lazy(() =>
  import("./components/VietnamMap").then((m) => ({ default: m.VietnamMap })),
);
const CommunityFeed = lazy(() =>
  import("./features/CommunityFeed").then((m) => ({
    default: m.CommunityFeed,
  })),
);
const ItineraryPlanner = lazy(() =>
  import("./features/ItineraryPlanner").then((m) => ({
    default: m.ItineraryPlanner,
  })),
);
const LoyaltyProfile = lazy(() =>
  import("./features/LoyaltyProfile").then((m) => ({
    default: m.LoyaltyProfile,
  })),
);
const DestinationDialog = lazy(() =>
  import("./features/DestinationDialog").then((m) => ({
    default: m.DestinationDialog,
  })),
);
const allowedTabs: AppTab[] = [
  "explore",
  "planner",
  "community",
  "notebook",
  "profile",
  "admin",
];
function initialTab(): AppTab {
  const tab = new URLSearchParams(window.location.search).get("tab") as AppTab;
  return allowedTabs.includes(tab) ? tab : "explore";
}
function Application() {
  const { user, loading, error: authError, logout } = useAuth();
  const [tab, setTab] = useState<AppTab>(initialTab),
    [auth, setAuth] = useState<AuthMode | null>(null),
    [notice, setNotice] = useState("");
  const [provinces] = useState(() => catalog.getProvinces()),
    [province, setProvince] = useState<Province | null>(null),
    [location, setLocation] = useState<LocationItem | null>(null),
    [planProvince, setPlanProvince] = useState("");
  const [visited, setVisited] = useState<number[]>([]),
    [ratings, setRatings] = useState<
      Record<number, { average: number; count: number }>
    >({});
  const [dataVersion, setDataVersion] = useState(0);
  const [locations, setLocations] = useState(() => catalog.getLocations());
  const [catalogError, setCatalogError] = useState("");
  const onChanged = useCallback(() => setDataVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    void request<ManagedPlace[]>("/v1/places", { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        const places = rows.map(locationFromManaged);
        setLocations(places);
        setLocation((current) =>
          current
            ? places.find((p) => p.location_id === current.location_id) || null
            : null,
        );
        setCatalogError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCatalogError(
            "Chưa tải được danh sách điểm đến mới nhất. Đang hiển thị dữ liệu đã có.",
          );
      });
    return () => controller.abort();
  }, [dataVersion]);
  useEffect(() => {
    const controller = new AbortController();
    void request<typeof ratings>("/v1/places/ratings", {
      signal: controller.signal,
    })
      .then(setRatings)
      .catch(() => {});
    return () => controller.abort();
  }, [dataVersion]);
  useEffect(() => {
    setVisited([]);
    if (!user) return;
    const controller = new AbortController();
    void request<{ provinces: number[] }>("/v1/checkins", {
      signal: controller.signal,
    })
      .then((value) => setVisited(value.provinces))
      .catch(() => {});
    return () => controller.abort();
  }, [user?.id, dataVersion]);
  const selectTab = (next: AppTab) => {
    setTab(next);
    setProvince(null);
    setLocation(null);
    setNotice("");
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  };
  const headerUser: User = {
    user_id: 0,
    auth_id: user?.id,
    username: user?.name || "Khách",
    email: user?.email || "",
    role: user?.role === "ADMIN" ? "admin" : user ? "user" : "guest",
    total_points: user?.points || 0,
    avatar: "",
    title: tierFor(user?.points || 0).name,
    visited_provinces: visited,
    visited_locations: [],
    wishlist_locations: [],
  };
  const signIn = () => setAuth("login");
  const plan = (p: Province) => {
    setPlanProvince(p.name);
    selectTab("planner");
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[2000] rounded-lg bg-white p-3 focus:not-sr-only"
      >
        Đến nội dung chính
      </a>
      <Header
        currentTab={tab}
        onSelectTab={selectTab}
        currentUser={headerUser}
        authLoading={loading}
        onSignIn={signIn}
        onSignUp={() => setAuth("register")}
        onAdminSignIn={() => setAuth("admin")}
        onSignOut={() => {
          void logout()
            .then(() => {
              setProvince(null);
              setLocation(null);
            })
            .catch((failure) => setNotice(failure.message));
        }}
      />
      {(notice || authError) && (
        <p
          role="status"
          className="border-b border-slate-200 bg-white px-5 py-3 text-sm"
        >
          {notice || authError}
        </p>
      )}
      <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
        {tab === "explore" && (
          <Suspense
            fallback={
              <p role="status" className="p-8 text-center">
                Đang tải bản đồ…
              </p>
            }
          >
            <div className="mx-auto max-w-[1600px] p-3 sm:p-5 lg:px-8">
              {catalogError && (
                <p role="status" className="mb-3 text-sm text-amber-800">
                  {catalogError}{" "}
                  <button className="underline" onClick={onChanged}>
                    Thử lại
                  </button>
                </p>
              )}
              <VietnamMap
                locations={locations}
                provinces={provinces}
                onSelectProvince={setProvince}
                selectedProvinceId={province?.province_id}
                visitedProvinceIds={visited}
                focusedLocation={location}
                onPlanProvince={plan}
                onSelectLocation={setLocation}
                ratings={ratings}
              />
            </div>
          </Suspense>
        )}
        <Suspense
          fallback={
            <p role="status" className="p-8 text-center">
              Đang tải…
            </p>
          }
        >
          <div key={`${user?.id || "guest"}:${tab}`}>
            {tab === "admin" &&
              (loading ? (
                <p role="status" className="p-8">
                  Đang kiểm tra tài khoản…
                </p>
              ) : user?.role === "ADMIN" ? (
                <AdminDashboard onPlacesChanged={onChanged} />
              ) : (
                <div className="page-shell empty-state">
                  <h1 className="text-xl font-semibold">Khu vực quản trị</h1>
                  <p>
                    {user
                      ? "Tài khoản hiện tại không có quyền quản trị."
                      : "Vui lòng đăng nhập bằng tài khoản quản trị viên."}
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => setAuth("admin")}
                  >
                    Đăng nhập quản trị viên
                  </button>
                </div>
              ))}
            {tab === "community" && <CommunityFeed onSignIn={signIn} />}
            {(tab === "planner" || tab === "notebook") && (
              <ItineraryPlanner
                notebook={tab === "notebook"}
                province={planProvince}
                sharedId={
                  new URLSearchParams(window.location.search).get("plan") ||
                  undefined
                }
                onSignIn={signIn}
              />
            )}
            {tab === "profile" &&
              (user ? (
                <LoyaltyProfile />
              ) : (
                <div className="page-shell empty-state">
                  <p>Đăng nhập để xem hạng thành viên và lịch sử tích điểm.</p>
                  <button className="btn-primary" onClick={signIn}>
                    Đăng nhập
                  </button>
                </div>
              ))}
          </div>
          {location && (
            <DestinationDialog
              key={`${location.location_id}:${user?.id || "guest"}`}
              place={location}
              onClose={() => setLocation(null)}
              onSignIn={signIn}
              onChanged={onChanged}
            />
          )}
        </Suspense>
      </main>
      {province && (
        <Dialog
          title={province.name}
          description="Khám phá văn hóa, thiên nhiên và những điểm dừng chân."
          className="!max-w-3xl"
          onClose={() => setProvince(null)}
        >
          <img
            src={province.cover_image}
            alt={`Khám phá ${province.name}`}
            className="mt-5 h-48 w-full rounded-2xl object-cover"
          />
          <section
            className="mt-5 space-y-4"
            aria-label={`Giới thiệu ${province.name}`}
          >
            <h2 className="text-xl font-semibold">
              Giới thiệu {province.name}
            </h2>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
              {province.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Lịch sử & văn hóa", province.history_brief],
                ["Địa lý & cảnh quan", province.geography_brief],
                ["Ẩm thực đặc trưng", province.specialty_dish],
                ["Lễ hội & trải nghiệm", province.top_festival],
              ].map(([title, content]) => (
                <article key={title} className="rounded-xl bg-paper p-4">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {content}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <button className="btn-primary my-5" onClick={() => plan(province)}>
            Lên lịch trình tại đây
          </button>
          <div className="space-y-3">
            <h2 className="font-semibold">Địa điểm nổi bật</h2>
            {catalogError && (
              <p role="status" className="text-sm text-amber-800">
                {catalogError}{" "}
                <button className="underline" onClick={onChanged}>
                  Thử lại
                </button>
              </p>
            )}
            {!locations.some(
              (place) => place.province_id === province.province_id,
            ) && (
              <p className="text-sm text-muted">
                Chưa có địa điểm được đăng tại tỉnh/thành này.
              </p>
            )}
            {locations
              .filter((place) => place.province_id === province.province_id)
              .map((place) => (
                <button
                  key={place.location_id}
                  className="block w-full rounded-xl border border-slate-200 p-4 text-left hover:bg-paper"
                  onClick={() => {
                    setLocation(place);
                    setProvince(null);
                  }}
                >
                  <span className="font-semibold">{place.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    Địa chỉ tham khảo: {place.address}
                  </span>
                  <span className="mt-2 block line-clamp-2 text-sm leading-6 text-slate-600">
                    {place.description}
                  </span>
                  <span className="mt-2 block text-sm font-medium text-teal-700">
                    Đọc giới thiệu →
                  </span>
                </button>
              ))}
          </div>
        </Dialog>
      )}
      {auth && (
        <SignInDialog
          key={auth}
          initialMode={auth}
          onClose={() => setAuth(null)}
          onSuccess={(account) => {
            if (account.role === "ADMIN") selectTab("admin");
            else if (tab === "admin") selectTab("explore");
          }}
        />
      )}
    </div>
  );
}
export function App() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}
export default App;
