import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const stack: HTMLElement[] = [];
let savedOverflow = "";
const focusable = (element: HTMLElement) =>
  Array.from(
    element.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((item) => item.getClientRects().length > 0);

export default function Dialog({
  title,
  description,
  onClose,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!stack.length) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    stack.push(panel);
    const isTop = () => stack.at(-1) === panel;
    const focusFirst = () =>
      (
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        focusable(panel)[0] ??
        panel
      ).focus();
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable(panel),
          first = items[0],
          last = items.at(-1);
        if (!first || !last) {
          event.preventDefault();
          panel.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === panel)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === panel)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTop() && !panel.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const wasTop = isTop(),
        index = stack.indexOf(panel);
      if (index >= 0) stack.splice(index, 1);
      if (!stack.length) document.body.style.overflow = savedOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          stack.at(-1) === panelRef.current
        )
          onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl outline-none sm:p-8 ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
        <h2 id={titleId} className="pr-8 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-slate-500"
          >
            {description}
          </p>
        )}
        {children}
      </section>
    </div>,
    document.body,
  );
}
