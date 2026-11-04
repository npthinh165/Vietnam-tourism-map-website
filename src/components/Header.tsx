import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Compass,
  LogOut,
  Map,
  Users,
  Bell,
  Award,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import type { User } from "../types";

export type AppTab =
  "explore" | "planner" | "community" | "notebook" | "profile" | "admin";
const navigation = [
  { id: "explore", label: "Bản đồ & Khám phá", icon: Compass },
  { id: "planner", label: "Lịch trình", icon: CalendarDays },
  { id: "community", label: "Cộng đồng", icon: Users },
  { id: "notebook", label: "Sổ tay hành trình", icon: BookOpen },
] as const;

export function Avatar({
  user,
  className = "",
}: {
  user: User;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user.avatar]);
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-semibold text-teal-800 ${className}`}
    >
      {user.avatar && !failed ? (
        <img
          src={user.avatar}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        user.username.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  currentUser: User;
  onSignIn: () => void;
  onSignUp: () => void;
  onAdminSignIn: () => void;
  onSignOut: () => void;
  authLoading?: boolean;
  unreadCount?: number;
  onNotifications?: () => void;
}

export function Header({
  currentTab,
  onSelectTab,
  currentUser,
  onSignIn,
  onSignUp,
  onAdminSignIn,
  onSignOut,
  authLoading,
  unreadCount = 0,
  onNotifications,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signedIn = currentUser.role !== "guest";
  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]',
        ) || [],
      );
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[
        (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
          items.length
      ].focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", onKeyDown);
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);
  const navigate = (tab: AppTab) => {
    setMenuOpen(false);
    onSelectTab(tab);
  };
  return (
    <header className="relative z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("explore")}
          className="flex shrink-0 items-center gap-2.5 text-left"
          aria-label="Bản đồ Du lịch Việt Nam — Trang chủ"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Map size={22} strokeWidth={1.6} />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-slate-900">
              Việt Nam <span className="text-brand">ơi!</span>
            </span>
            <span className="block text-xs text-slate-500">Bản đồ du lịch</span>
          </span>
        </button>
        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-1 lg:flex"
        >
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              aria-current={currentTab === id ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${currentTab === id ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn && (
            <>
              <button
                onClick={() => navigate("profile")}
                className="hidden items-center gap-1.5 rounded-full bg-[#fff4d9] px-2.5 py-1.5 text-xs font-bold text-[#805b13] xl:flex"
                aria-label={`Thành tích: ${currentUser.total_points} điểm`}
              >
                <Award size={15} />
                {currentUser.total_points} điểm
              </button>
              {onNotifications && (
                <button
                  className="relative rounded-full p-2.5 text-muted hover:bg-paper"
                  aria-label={`Thông báo, ${unreadCount} chưa đọc`}
                  onClick={onNotifications}
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />
                  )}
                </button>
              )}
            </>
          )}
          {!signedIn ? (
            <>
              <button
                disabled={authLoading}
                onClick={onAdminSignIn}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đăng nhập quản trị viên"
                title="Đăng nhập quản trị viên"
              >
                <ShieldCheck size={19} />
              </button>
              <button
                disabled={authLoading}
                onClick={onSignIn}
                className="btn-secondary"
              >
                {authLoading ? "Đang kết nối…" : "Đăng nhập"}
              </button>
              <button
                disabled={authLoading}
                onClick={onSignUp}
                className="btn-primary hidden sm:inline-flex"
              >
                Đăng ký
              </button>
            </>
          ) : (
            <div
              ref={menuRef}
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setMenuOpen(false);
              }}
            >
              <button
                ref={triggerRef}
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="account-menu"
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50"
                aria-label={`Tài khoản ${currentUser.username}`}
              >
                <Avatar user={currentUser} />
                <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
                  {currentUser.username}
                </span>
                <ChevronDown size={15} className="text-slate-500" />
              </button>
              {menuOpen && (
                <div
                  id="account-menu"
                  role="menu"
                  aria-label="Tài khoản"
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                >
                  <div className="mb-1 border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold">
                      {currentUser.username}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {currentUser.email}
                    </p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => navigate("notebook")}
                    className="menu-item"
                  >
                    <BookOpen size={16} />
                    Sổ tay hành trình
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => navigate("profile")}
                    className="menu-item"
                  >
                    <UserRound size={16} />
                    Hồ sơ cá nhân
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  {currentUser.role === "admin" && (
                    <button
                      role="menuitem"
                      onClick={() => navigate("admin")}
                      className="menu-item"
                    >
                      <ShieldCheck size={16} />
                      Trang quản trị
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="menu-item"
                  >
                    <LogOut size={16} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <nav
        aria-label="Điều hướng trên điện thoại"
        className="grid grid-cols-4 border-t border-slate-100 px-2 lg:hidden"
      >
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            aria-current={currentTab === id ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 border-b-2 px-1 py-2 text-[11px] font-medium sm:flex-row sm:gap-2 sm:text-sm ${currentTab === id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500"}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
