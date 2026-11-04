export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrfToken: string | null = null;
export function setCsrfToken(value: string | null) {
  csrfToken = value;
}
export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method || "GET";
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        ...(!["GET", "HEAD"].includes(method)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/"))
        window.dispatchEvent(new Event("travel:session-expired"));
      throw new ApiError(
        data?.error ||
          ([502, 503, 504].includes(response.status)
            ? "Chưa kết nối được dịch vụ. Vui lòng thử lại sau ít phút."
            : "Không thể hoàn tất yêu cầu."),
        response.status,
      );
    }
    if (data === null)
      throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ.", 502);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "Yêu cầu quá thời gian. Kiểm tra kết quả trước khi thử lại."
        : "Chưa kết nối được máy chủ. Vui lòng thử lại.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
