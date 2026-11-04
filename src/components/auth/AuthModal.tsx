import { useId, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import Dialog from "../ui/Dialog";
import { authService } from "../../services/authService";

export type AuthMode = "login" | "register" | "forgot" | "recovery";
const titles = {
  login: "Chào mừng trở lại",
  register: "Tạo tài khoản",
  forgot: "Quên mật khẩu",
  recovery: "Đặt mật khẩu mới",
};
const descriptions = {
  login: "Đăng nhập để lưu và tiếp tục hành trình của bạn.",
  register: "Một tài khoản cho những chuyến đi tiếp theo.",
  forgot: "Nhập email để nhận liên kết đặt lại mật khẩu.",
  recovery: "Chọn mật khẩu mới cho tài khoản của bạn.",
};

export default function AuthModal({
  mode: initialMode,
  onClose,
  onSuccess,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const id = useId();
  const configured = authService.isConfigured();
  const isNewPassword = mode === "register" || mode === "recovery";
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !configured) return;
    setError("");
    if (mode === "register" && !name.trim()) {
      setError("Vui lòng nhập tên của bạn.");
      return;
    }
    if (isNewPassword && password.length < 8) {
      setError("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (isNewPassword && password !== confirmation) {
      setError("Hai mật khẩu chưa khớp. Vui lòng kiểm tra lại.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await authService.signIn(email, password);
        onSuccess?.();
        onClose();
      } else if (mode === "register") {
        const result = await authService.signUp(name, email, password);
        if (result.needsEmailConfirmation) {
          setMessage(
            "Vui lòng kiểm tra hộp thư để xác nhận email trước khi đăng nhập.",
          );
          setPassword("");
          setConfirmation("");
        } else {
          onSuccess?.();
          onClose();
        }
      } else if (mode === "forgot") {
        await authService.resetPassword(email);
        setMessage(
          "Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra cả thư mục spam.",
        );
      } else {
        await authService.updatePassword(password);
        setPassword("");
        setConfirmation("");
        setMessage("Mật khẩu đã được cập nhật.");
        onSuccess?.();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Có lỗi xảy ra. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  };
  const googleSignIn = async () => {
    setBusy(true);
    setError("");
    try {
      await authService.signInWithGoogle();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không thể đăng nhập Google.",
      );
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={titles[mode]}
      description={descriptions[mode]}
      onClose={onClose}
    >
      {!configured && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
        >
          Đăng nhập hiện chưa khả dụng. Vui lòng liên hệ quản trị viên để kết
          nối dịch vụ xác thực.
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message ? (
        <div className="mt-6 space-y-5">
          <p
            role="status"
            className="flex gap-3 rounded-lg bg-teal-50 p-4 text-sm leading-6 text-teal-900"
          >
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            {message}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={mode === "recovery" ? onClose : () => switchMode("login")}
          >
            {mode === "recovery" ? "Tiếp tục khám phá" : "Về đăng nhập"}
          </button>
        </div>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="mt-6 space-y-4"
            aria-busy={busy}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            {mode === "register" && (
              <div>
                <label htmlFor={`${id}-name`} className="field-label">
                  Họ và tên
                </label>
                <input
                  data-autofocus
                  id={`${id}-name`}
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                  disabled={busy}
                  className="field"
                  placeholder="Tên của bạn"
                />
              </div>
            )}
            {mode !== "recovery" && (
              <div>
                <label htmlFor={`${id}-email`} className="field-label">
                  Email
                </label>
                <input
                  data-autofocus={mode !== "register" ? true : undefined}
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  disabled={busy}
                  className="field"
                  placeholder="ban@example.com"
                />
              </div>
            )}
            {mode !== "forgot" && (
              <div>
                <label htmlFor={`${id}-password`} className="field-label">
                  {mode === "recovery" ? "Mật khẩu mới" : "Mật khẩu"}
                </label>
                <div className="relative">
                  <input
                    data-autofocus={mode === "recovery" ? true : undefined}
                    id={`${id}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      isNewPassword ? "new-password" : "current-password"
                    }
                    minLength={isNewPassword ? 8 : undefined}
                    required
                    disabled={busy}
                    className="field pr-11"
                    placeholder={
                      isNewPassword ? "Ít nhất 8 ký tự" : "Nhập mật khẩu"
                    }
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute bottom-1 right-1 rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
            {isNewPassword && (
              <div>
                <label htmlFor={`${id}-confirmation`} className="field-label">
                  Nhập lại mật khẩu
                </label>
                <input
                  id={`${id}-confirmation`}
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={busy}
                  className="field"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            )}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => switchMode("forgot")}
                  className="text-sm font-medium text-teal-700"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !configured}
              className="btn-primary w-full"
            >
              {busy && <LoaderCircle size={17} className="animate-spin" />}
              {busy
                ? "Đang xử lý…"
                : {
                    login: "Đăng nhập",
                    register: "Tạo tài khoản",
                    forgot: "Gửi liên kết",
                    recovery: "Lưu mật khẩu mới",
                  }[mode]}
            </button>
          </form>
          {(mode === "login" || mode === "register") && (
            <>
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">hoặc</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                disabled={busy || !configured}
                onClick={() => {
                  void googleSignIn();
                }}
                className="btn-secondary w-full"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.38ZM12 22c2.7 0 4.96-.9 6.62-2.39l-3.24-2.52c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.05v2.6A10 10 0 0 0 12 22Zm-5.6-8.06a6 6 0 0 1 0-3.88v-2.6H3.05a10 10 0 0 0 0 9.08l3.35-2.6ZM12 5.94c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.46l3.35 2.6A5.99 5.99 0 0 1 12 5.94Z"
                  />
                </svg>
                Tiếp tục với Google
              </button>
              <p className="mt-6 text-center text-sm text-slate-500">
                {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    switchMode(mode === "login" ? "register" : "login")
                  }
                  className="font-medium text-teal-700"
                >
                  {mode === "login" ? "Đăng ký" : "Đăng nhập"}
                </button>
              </p>
            </>
          )}
          {mode === "forgot" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => switchMode("login")}
              className="mx-auto mt-5 flex items-center gap-1.5 text-sm font-medium text-teal-700"
            >
              <ArrowLeft size={15} />
              Về đăng nhập
            </button>
          )}
        </>
      )}
    </Dialog>
  );
}
