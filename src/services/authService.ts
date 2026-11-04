export interface AuthUser {
  id: string;
  app_metadata?: { role?: string; [key: string]: unknown };
  email?: string;
  user_metadata: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    [key: string]: unknown;
  };
}
export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "ERROR";
interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}
interface TokenResponse extends AuthSession {
  expires_in?: number;
}
type Listener = (event: AuthEvent, user: AuthUser | null) => void;

const baseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const sessionKey = `vntravel.auth.v1:${baseUrl}`;
const verifierKey = `vntravel.pkce.v1:${baseUrl}`;
class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

function localizedError(message: string): string {
  if (/invalid login credentials|invalid_credentials/i.test(message))
    return "Email hoặc mật khẩu không đúng.";
  if (/email not confirmed/i.test(message))
    return "Vui lòng xác nhận email trước khi đăng nhập.";
  if (
    /already registered|already been registered|user_already_exists/i.test(
      message,
    )
  )
    return "Email này đã được đăng ký. Bạn có thể đăng nhập hoặc đặt lại mật khẩu.";
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message))
    return "Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.";
  if (/password.*(short|least|weak)|weak_password/i.test(message))
    return "Mật khẩu chưa đủ mạnh. Hãy sử dụng ít nhất 8 ký tự.";
  if (/same_password/i.test(message))
    return "Hãy chọn mật khẩu khác mật khẩu hiện tại.";
  if (/invalid.*email|email.*invalid/i.test(message))
    return "Địa chỉ email không hợp lệ.";
  if (/expired|invalid.*token|refresh_token_not_found/i.test(message))
    return "Phiên hoặc liên kết đã hết hạn. Vui lòng đăng nhập lại hoặc yêu cầu liên kết mới.";
  if (/signup.*disabled|signups.*not allowed/i.test(message))
    return "Dịch vụ hiện chưa cho phép tạo tài khoản mới.";
  return "Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại sau.";
}

class AuthService {
  private session: AuthSession | null = null;
  private listeners = new Set<Listener>();
  private initialization?: Promise<AuthUser | null>;
  private refreshPromise?: Promise<AuthSession | null>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private error: string | null = null;
  private revision = 0;

  isConfigured = () => /^https?:\/\//.test(baseUrl) && Boolean(publicKey);
  getUser = () => this.session?.user ?? null;
  getAccessToken = async (): Promise<string | null> => {
    if (this.session && this.session.expires_at * 1000 <= Date.now() + 60000) await this.refresh();
    return this.session?.access_token ?? null;
  };
  getError = () => this.error;
  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(event: AuthEvent) {
    this.listeners.forEach((listener) => listener(event, this.getUser()));
  }
  private requireConfig() {
    if (!this.isConfigured())
      throw new AuthError(
        "Đăng nhập chưa được cấu hình. Vui lòng liên hệ quản trị viên để kết nối dịch vụ xác thực.",
      );
  }
  private callbackUrl(mode = "callback") {
    return `${window.location.origin}${window.location.pathname}?auth=${mode}`;
  }

  private async request<T>(
    path: string,
    body?: unknown,
    token?: string,
    method = "POST",
  ): Promise<T> {
    this.requireConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${baseUrl}/auth/v1${path}`, {
        method,
        signal: controller.signal,
        headers: {
          apikey: publicKey,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new AuthError(
          localizedError(
            String(
              data.msg ??
                data.message ??
                data.error_description ??
                data.error ??
                "",
            ),
          ),
          response.status,
        );
      return data as T;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(
        "Không thể kết nối dịch vụ xác thực. Vui lòng kiểm tra kết nối và thử lại.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  private normalize(payload: TokenResponse): AuthSession {
    if (!payload.access_token || !payload.refresh_token || !payload.user?.id)
      throw new AuthError("Phiên đăng nhập không hợp lệ. Vui lòng thử lại.");
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      user: payload.user,
      expires_at:
        payload.expires_at ||
        Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
    };
  }
  private setSession(
    session: AuthSession | null,
    event: AuthEvent,
    persist = true,
  ) {
    this.revision += 1;
    this.session = session;
    this.error = null;
    clearTimeout(this.refreshTimer);
    if (persist) {
      try {
        if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
        else localStorage.removeItem(sessionKey);
      } catch {
        /* In-memory sessions still work when storage is unavailable. */
      }
    }
    if (session)
      this.refreshTimer = setTimeout(
        () => {
          void this.refresh().catch(() => undefined);
        },
        Math.max(1000, session.expires_at * 1000 - Date.now() - 60000),
      );
    this.emit(event);
  }
  private reportError(error: unknown) {
    this.error =
      error instanceof Error ? error.message : "Không thể xác thực tài khoản.";
    this.emit("ERROR");
  }
  private refresh(): Promise<AuthSession | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const current = this.session;
    if (!current) return Promise.resolve(null);
    const revision = this.revision;
    this.refreshPromise = this.request<TokenResponse>(
      "/token?grant_type=refresh_token",
      { refresh_token: current.refresh_token },
    )
      .then((payload) => {
        if (revision !== this.revision) return this.session;
        this.setSession(this.normalize(payload), "USER_UPDATED");
        return this.session;
      })
      .catch((error: unknown) => {
        if (revision === this.revision) {
          if (
            error instanceof AuthError &&
            (error.status === 400 || error.status === 401)
          )
            this.setSession(null, "SIGNED_OUT");
          else
            this.refreshTimer = setTimeout(() => {
              void this.refresh().catch(() => undefined);
            }, 30000);
          this.reportError(error);
        }
        throw error;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });
    return this.refreshPromise;
  }
  private async restore(raw: string | null, event: AuthEvent, persist = true) {
    const revision = this.revision;
    if (!raw) {
      this.setSession(null, event, persist);
      return;
    }
    let stored: AuthSession;
    try {
      stored = JSON.parse(raw) as AuthSession;
    } catch {
      this.setSession(null, event, persist);
      return;
    }
    if (!stored.access_token || !stored.refresh_token || !stored.user?.id) {
      this.setSession(null, event, persist);
      return;
    }
    try {
      const refreshed = stored.expires_at * 1000 <= Date.now() + 60000;
      const session = refreshed
        ? this.normalize(
            await this.request<TokenResponse>(
              "/token?grant_type=refresh_token",
              { refresh_token: stored.refresh_token },
            ),
          )
        : {
            ...stored,
            user: await this.request<AuthUser>(
              "/user",
              undefined,
              stored.access_token,
              "GET",
            ),
          };
      if (revision === this.revision)
        this.setSession(session, event, persist || refreshed);
    } catch (error) {
      if (revision !== this.revision) return;
      if (
        error instanceof AuthError &&
        (error.status === 400 || error.status === 401)
      )
        this.setSession(null, "SIGNED_OUT", persist);
      this.reportError(error);
    }
  }
  initialize = (): Promise<AuthUser | null> => {
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      if (!this.isConfigured()) {
        this.emit("INITIAL_SESSION");
        return null;
      }
      window.addEventListener("storage", (event) => {
        if (event.key === sessionKey) {
          this.revision += 1;
          void this.restore(
            event.newValue,
            event.newValue ? "SIGNED_IN" : "SIGNED_OUT",
            false,
          );
        }
      });
      document.addEventListener("visibilitychange", () => {
        if (
          document.visibilityState === "visible" &&
          this.session &&
          this.session.expires_at * 1000 <= Date.now() + 60000
        )
          void this.refresh().catch(() => undefined);
      });
      try {
        const url = new URL(window.location.href),
          hash = new URLSearchParams(url.hash.slice(1));
        const isCallback =
          url.searchParams.get("auth") === "callback" ||
          url.searchParams.get("auth") === "recovery";
        const hasTokens = hash.has("access_token");
        const code = isCallback ? url.searchParams.get("code") : null;
        const callbackError = isCallback
          ? (url.searchParams.get("error") ?? hash.get("error"))
          : null;
        if (isCallback || hasTokens) {
          const recovery =
            url.searchParams.get("auth") === "recovery" ||
            hash.get("type") === "recovery";
          for (const key of [
            "auth",
            "code",
            "error",
            "error_code",
            "error_description",
          ])
            url.searchParams.delete(key);
          if (hasTokens || hash.has("error")) url.hash = "";
          window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`,
          );
          if (callbackError)
            throw new AuthError(
              "Liên kết xác thực không hợp lệ, đã hết hạn hoặc đã bị hủy. Vui lòng thử lại.",
            );
          if (code) {
            const saved = sessionStorage.getItem(verifierKey);
            sessionStorage.removeItem(verifierKey);
            const pkce = saved
              ? (JSON.parse(saved) as { verifier: string; createdAt: number })
              : null;
            if (!pkce?.verifier || Date.now() - pkce.createdAt > 15 * 60 * 1000)
              throw new AuthError(
                "Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.",
              );
            const payload = await this.request<TokenResponse>(
              "/token?grant_type=pkce",
              { auth_code: code, code_verifier: pkce.verifier },
            );
            this.setSession(
              this.normalize(payload),
              recovery ? "PASSWORD_RECOVERY" : "SIGNED_IN",
            );
            return this.getUser();
          }
          if (hasTokens) {
            const accessToken = hash.get("access_token")!,
              refreshToken = hash.get("refresh_token");
            if (!refreshToken)
              throw new AuthError(
                "Liên kết xác thực không hợp lệ. Vui lòng yêu cầu liên kết mới.",
              );
            const user = await this.request<AuthUser>(
              "/user",
              undefined,
              accessToken,
              "GET",
            );
            this.setSession(
              this.normalize({
                access_token: accessToken,
                refresh_token: refreshToken,
                user,
                expires_at: Number(hash.get("expires_at")) || 0,
                expires_in: Number(hash.get("expires_in")) || 3600,
              }),
              recovery ? "PASSWORD_RECOVERY" : "SIGNED_IN",
            );
            return user;
          }
        }
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(sessionKey);
        } catch {
          /* Storage can be unavailable. */
        }
        await this.restore(stored, "INITIAL_SESSION");
      } catch (error) {
        this.reportError(error);
      }
      return this.getUser();
    })();
    return this.initialization;
  };
  signIn = async (email: string, password: string) => {
    const revision = ++this.revision;
    const payload = await this.request<TokenResponse>(
      "/token?grant_type=password",
      { email: email.trim(), password },
    );
    if (revision === this.revision)
      this.setSession(this.normalize(payload), "SIGNED_IN");
  };
  signUp = async (name: string, email: string, password: string) => {
    const revision = ++this.revision;
    const payload = await this.request<TokenResponse>(
      `/signup?redirect_to=${encodeURIComponent(this.callbackUrl())}`,
      { email: email.trim(), password, data: { full_name: name.trim() } },
    );
    if (payload.access_token && revision === this.revision)
      this.setSession(this.normalize(payload), "SIGNED_IN");
    return { needsEmailConfirmation: !payload.access_token };
  };
  resetPassword = async (email: string) => {
    await this.request(
      `/recover?redirect_to=${encodeURIComponent(this.callbackUrl("recovery"))}`,
      { email: email.trim() },
    );
  };
  updatePassword = async (password: string) => {
    if (!this.session)
      throw new AuthError("Vui lòng mở liên kết đặt lại mật khẩu trong email.");
    if (this.session.expires_at * 1000 <= Date.now() + 60000)
      await this.refresh();
    const current = this.session;
    if (!current)
      throw new AuthError(
        "Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới.",
      );
    const revision = this.revision;
    const user = await this.request<AuthUser>(
      "/user",
      { password },
      current.access_token,
      "PUT",
    );
    if (revision === this.revision)
      this.setSession({ ...current, user }, "USER_UPDATED");
  };
  updateProfile = async (data: Record<string, unknown>) => {
    if (!this.session)
      throw new AuthError("Vui lòng đăng nhập để cập nhật tài khoản.");
    if (this.session.expires_at * 1000 <= Date.now() + 60000)
      await this.refresh();
    const current = this.session;
    if (!current) throw new AuthError("Phiên đăng nhập đã hết hạn.");
    const revision = this.revision;
    const user = await this.request<AuthUser>(
      "/user",
      { data },
      current.access_token,
      "PUT",
    );
    if (revision === this.revision)
      this.setSession({ ...current, user }, "USER_UPDATED");
    return user;
  };
  signInWithGoogle = async () => {
    this.requireConfig();
    if (!window.crypto?.subtle)
      throw new AuthError(
        "Đăng nhập Google yêu cầu kết nối HTTPS hoặc localhost.",
      );
    const encode = (value: Uint8Array) =>
      btoa(String.fromCharCode(...value))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = encode(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
    );
    try {
      sessionStorage.setItem(
        verifierKey,
        JSON.stringify({ verifier, createdAt: Date.now() }),
      );
    } catch {
      throw new AuthError(
        "Hãy cho phép lưu trữ phiên trong trình duyệt để đăng nhập Google.",
      );
    }
    const params = new URLSearchParams({
      provider: "google",
      redirect_to: this.callbackUrl(),
      code_challenge: challenge,
      code_challenge_method: "s256",
    });
    window.location.assign(`${baseUrl}/auth/v1/authorize?${params}`);
  };
  signOut = async () => {
    const token = this.session?.access_token;
    this.setSession(null, "SIGNED_OUT");
    if (token) {
      try {
        await this.request("/logout?scope=local", undefined, token);
      } catch {
        this.error =
          "Đã đăng xuất trên thiết bị này. Không thể thu hồi phiên từ máy chủ, phiên sẽ tự hết hạn.";
        this.emit("ERROR");
      }
    }
  };
}
export const authService = new AuthService();
