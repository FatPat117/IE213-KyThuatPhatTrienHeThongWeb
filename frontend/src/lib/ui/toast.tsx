'use client';

import toast, { Toast } from "react-hot-toast";

function buildToastId(kind: "success" | "error", message: string) {
  return `${kind}:${message.trim().toLowerCase()}`;
}

const ERROR_TOAST_DURATION_MS = 6500;
const SUCCESS_TOAST_DURATION_MS = 4500;

function scheduleAutoDismiss(toastId: string, durationMs: number) {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : 4000;
  window.setTimeout(() => {
    toast.dismiss(toastId);
  }, safeDuration + 120);
}

export function showSuccessToast(message: string) {
  const id = buildToastId("success", message);
  scheduleAutoDismiss(id, SUCCESS_TOAST_DURATION_MS);
  return toast.custom(
    (t: Toast) => (
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-emerald-300/80 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-950 shadow-lg ring-1 ring-emerald-200/60 transition ${
          t.visible ? 'animate-toast-in' : 'opacity-0'
        }`}
      >
        <span className="mt-0.5 shrink-0 text-lg" aria-hidden>
          ✅
        </span>
        <div className="min-w-0 flex-1 leading-snug">{message}</div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="ml-1 shrink-0 rounded-full p-1.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    ),
    { id, duration: SUCCESS_TOAST_DURATION_MS },
  );
}

export type ErrorToastOptions = {
  /** Mặc định: bật — toast đỏ nổi bật, ở lâu hơn */
  emphasis?: boolean;
  durationMs?: number;
};

export function showErrorToast(message: string, options?: ErrorToastOptions) {
  const emphasis = options?.emphasis !== false;
  const id = buildToastId("error", message);
  const duration =
    options?.durationMs ??
    (emphasis ? ERROR_TOAST_DURATION_MS : 5000);
  scheduleAutoDismiss(id, duration);

  return toast.custom(
    (t: Toast) => (
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border-2 border-red-600 bg-red-50 px-4 py-4 text-base font-semibold leading-snug text-red-950 shadow-[0_12px_40px_-8px_rgba(185,28,28,0.55)] ring-2 ring-red-500/35 transition sm:max-w-lg ${
          emphasis ? 'border-l-[6px] border-l-red-700' : 'border-red-300'
        } ${t.visible ? 'animate-toast-in' : 'opacity-0'}`}
        role="alert"
      >
        <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
          ⛔
        </span>
        <div className="min-w-0 flex-1">
          {emphasis && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-red-800">
              Cần chú ý
            </p>
          )}
          <p className="font-semibold">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="ml-1 shrink-0 rounded-full p-1.5 text-base font-bold text-red-900 hover:bg-red-100"
          aria-label="Đóng"
        >
          ×
        </button>
      </div>
    ),
    { id, duration },
  );
}

