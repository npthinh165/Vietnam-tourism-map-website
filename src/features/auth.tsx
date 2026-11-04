import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loginSchema,
  signupSchema,
  type SessionUser,
} from "../../shared/travel";
import { request, setCsrfToken } from "../services/httpClient";
import Dialog from "../components/ui/Dialog";

interface Session {
  user: SessionUser | null;
  csrfToken: string | null;
}
export type AuthMode = "login" | "register" | "admin";
interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (
    email: string,
    password: string,
    admin?: boolean,
  ) => Promise<SessionUser>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<SessionUser>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const channel = useRef<BroadcastChannel | null>(null),
    revision = useRef(0);
  const accept = useCallback((session: Session) => {
    setUser(session.user);
    setCsrfToken(session.csrfToken);
    setError("");
  }, []);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const session = await request<Session>("/auth/session");
      if (current === revision.current) accept(session);
    } catch (failure) {
      if (current === revision.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Chưa tải được phiên đăng nhập.",
        );
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    void refresh();
    const expired = () => {
      ++revision.current;
      accept({ user: null, csrfToken: null });
      setLoading(false);
      setError("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
    };
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("travel:session-expired", expired);
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 60000);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("vntravel-session");
      channel.current.onmessage = () => void refresh();
    }
    return () => {
      ++revision.current;
      clearInterval(timer);
      channel.current?.close();
      window.removeEventListener("focus", focus);
      window.removeEventListener("travel:session-expired", expired);
    };
  }, [accept, refresh]);
  const authenticate = async (path: string, body: unknown) => {
    ++revision.current;
    try {
      const session = await request<Session>(path, { method: "POST", body });
      if (!session.user)
        throw new Error(
          "Chưa xác nhận được tài khoản. Vui lòng đăng nhập lại.",
        );
      ++revision.current;
      accept(session);
      channel.current?.postMessage("changed");
      return session.user;
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refresh,
        login: (email, password, admin = false) =>
          authenticate(
            admin ? "/auth/admin/signin" : "/auth/signin",
            loginSchema.parse({ email, password }),
          ),
        signup: (name, email, password) =>
          authenticate(
            "/auth/signup",
            signupSchema.parse({ name, email, password }),
          ),
        logout: async () => {
          await request("/auth/signout", { method: "POST", body: {} });
          ++revision.current;
          accept({ user: null, csrfToken: null });
          channel.current?.postMessage("changed");
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is required.");
  return auth;
}
export function SignInDialog({
  initialMode,
  onClose,
  onSuccess,
}: {
  initialMode: AuthMode;
  onClose: () => void;
  onSuccess?: (user: SessionUser) => void;
}) {
  const auth = useAuth(),
    [mode, setMode] = useState(initialMode),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
    setShow(false);
  };
  return (
    <Dialog
      title={
        mode === "admin"
          ? "Đăng nhập quản trị viên"
          : mode === "login"
            ? "Đăng nhập"
            : "Tạo tài khoản"
      }
      description={
        mode === "admin"
          ? "Dành cho tài khoản đã được cấp quyền quản trị."
          : "Lưu hành trình và khám phá Việt Nam cùng cộng đồng."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="mt-5 space-y-4"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          const parsed = (
            mode === "register" ? signupSchema : loginSchema
          ).safeParse(
            mode === "register"
              ? { name, email, password }
              : { email, password },
          );
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (mode === "register" && password !== confirm) {
            setError("Hai mật khẩu chưa khớp.");
            return;
          }
          setBusy(true);
          try {
            const user =
              mode === "register"
                ? await auth.signup(name, email, password)
                : await auth.login(email, password, mode === "admin");
            onSuccess?.(user);
            onClose();
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Không thể đăng nhập.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "register" && (
          <label className="field-label">
            Họ và tên
            <input
              data-autofocus
              name="name"
              className="field mt-1"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
        )}
        <label className="field-label">
          Email
          <input
            className="field mt-1"
            type="email"
            name="email"
            data-autofocus={mode !== "register" ? true : undefined}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field-label">
          Mật khẩu
          <input
            className="field mt-1"
            name="password"
            type={show ? "text" : "password"}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "register" ? 12 : 1}
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        {mode === "register" && (
          <>
            <p className="text-xs text-muted">
              Ít nhất 12 ký tự. Có thể dùng một cụm từ dễ nhớ.
            </p>
            <label className="field-label">
              Nhập lại mật khẩu
              <input
                className="field mt-1"
                name="confirmPassword"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Hiện mật khẩu
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy
            ? "Đang xử lý…"
            : mode === "register"
              ? "Đăng ký"
              : mode === "admin"
                ? "Đăng nhập quản trị"
                : "Đăng nhập"}
        </button>
        <button
          type="button"
          className="subtle-link"
          disabled={busy}
          onClick={() => switchMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Chưa có tài khoản? Đăng ký"
            : mode === "admin"
              ? "Về đăng nhập thành viên"
              : "Đã có tài khoản? Đăng nhập"}
        </button>
        {mode !== "admin" && (
          <button
            type="button"
            className="block text-sm text-slate-500 hover:text-teal-700"
            disabled={busy}
            onClick={() => switchMode("admin")}
          >
            Đăng nhập quản trị viên
          </button>
        )}
      </form>
    </Dialog>
  );
}
