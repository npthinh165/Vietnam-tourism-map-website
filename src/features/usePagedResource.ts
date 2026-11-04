import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "../../shared/travel";
import { request } from "../services/httpClient";

export function usePagedResource<T extends { id: string }>(
  path: string | null,
) {
  const [items, setItems] = useState<T[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const current = useRef(0),
    active = useRef<AbortController | null>(null),
    locked = useRef(false);
  const load = useCallback(
    async (next?: string) => {
      if (!path) return;
      if (next && locked.current) return;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const sequence = ++current.current;
      locked.current = true;
      setLoading(true);
      setError("");
      try {
        const page = await request<Page<T>>(
          path +
            (next
              ? `${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(next)}`
              : ""),
          { signal: controller.signal },
        );
        if (current.current !== sequence) return;
        setItems((previous) =>
          next
            ? [
                ...previous,
                ...page.items.filter(
                  (item) => !previous.some((p) => p.id === item.id),
                ),
              ]
            : page.items,
        );
        setCursor(page.nextCursor);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không thể tải dữ liệu.",
          );
      } finally {
        if (current.current === sequence) {
          locked.current = false;
          setLoading(false);
        }
      }
    },
    [path],
  );
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setError("");
    setLoading(false);
    void load();
    return () => {
      ++current.current;
      active.current?.abort();
      locked.current = false;
    };
  }, [load]);
  return {
    items,
    setItems,
    loading,
    error,
    reload: () => load(),
    more: () => (cursor ? load(cursor) : Promise.resolve()),
    hasMore: Boolean(cursor),
  };
}
