import { useState } from "react";
import { BookOpen, Mail } from "lucide-react";
import type { User } from "../types";
import { authService } from "../services/authService";
import { Avatar } from "./Header";

export function Profile({
  user,
  onOpenNotebook,
}: {
  user: User;
  onOpenNotebook: () => void;
}) {
  const [name, setName] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(success);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Chưa thể cập nhật tài khoản.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-7 text-2xl font-semibold tracking-tight">
        Hồ sơ cá nhân
      </h1>
      <div className="panel p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={user} className="!size-14 !text-xl" />
          <div>
            <p className="font-semibold">{user.username}</p>
            <p className="mt-1 text-sm text-slate-500">
              {user.visited_provinces.length} tỉnh, thành đã đến
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim())
              void perform(
                () => authService.updateProfile({ full_name: name.trim() }),
                "Đã cập nhật hồ sơ.",
              );
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="profile-name" className="field-label">
              Họ và tên
            </label>
            <input
              id="profile-name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              required
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="field-label">
              Email
            </label>
            <input
              id="profile-email"
              className="field !bg-slate-50 !text-slate-500"
              type="email"
              value={user.email}
              readOnly
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !name.trim()}
          >
            {busy ? "Đang xử lý…" : "Lưu thay đổi"}
          </button>
        </form>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => authService.resetPassword(user.email),
                "Đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra email.",
              )
            }
          >
            <Mail size={15} />
            Đặt lại mật khẩu
          </button>
          <button className="btn-secondary" onClick={onOpenNotebook}>
            <BookOpen size={15} />
            Mở sổ tay
          </button>
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm text-teal-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
