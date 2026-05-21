'use client';

import toast, { Toast } from "react-hot-toast";

function buildToastId(kind: "success" | "error", message: string) {
  return `${kind}:${message.trim().toLowerCase()}`;
}

const ERROR_TOAST_DURATION_MS = 6500;
const SUCCESS_TOAST_DURATION_MS = 4500;
const NOTIFICATION_TOAST_DURATION_MS = 6000;

function scheduleAutoDismiss(toastId: string, durationMs: number) {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : 4000;
  window.setTimeout(() => {
    toast.dismiss(toastId);
  }, safeDuration + 120);
}

type ToastVariant = "success" | "error" | "info";

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    shell: string;
    accent: string;
    label: string;
    labelClass: string;
    textClass: string;
    buttonClass: string;
    icon: string;
  }
> = {
  success: {
    shell:
      "border-2 border-emerald-600 bg-emerald-50 shadow-[0_12px_40px_-8px_rgba(5,150,105,0.45)] ring-2 ring-emerald-500/35",
    accent: "border-l-[6px] border-l-emerald-700",
    label: "Thành công",
    labelClass: "text-emerald-800",
    textClass: "text-emerald-950",
    buttonClass: "text-emerald-900 hover:bg-emerald-100",
    icon: "✅",
  },
  error: {
    shell:
      "border-2 border-red-600 bg-red-50 shadow-[0_12px_40px_-8px_rgba(185,28,28,0.55)] ring-2 ring-red-500/35",
    accent: "border-l-[6px] border-l-red-700",
    label: "Cần chú ý",
    labelClass: "text-red-800",
    textClass: "text-red-950",
    buttonClass: "text-red-900 hover:bg-red-100",
    icon: "⛔",
  },
  info: {
    shell:
      "border-2 border-blue-600 bg-blue-50 shadow-[0_12px_40px_-8px_rgba(37,99,235,0.45)] ring-2 ring-blue-500/35",
    accent: "border-l-[6px] border-l-blue-700",
    label: "Thông báo",
    labelClass: "text-blue-800",
    textClass: "text-blue-950",
    buttonClass: "text-blue-900 hover:bg-blue-100",
    icon: "🔔",
  },
};

function EmphasisToast({
  t,
  variant,
  message,
  label,
}: {
  t: Toast;
  variant: ToastVariant;
  message: string;
  /** Ghi đè nhãn mặc định (vd. tiêu đề notification) */
  label?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  const heading = label ?? styles.label;

  return (
    <div
      className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-4 text-base font-semibold leading-snug transition sm:max-w-lg ${styles.shell} ${styles.accent} ${styles.textClass} ${
        t.visible ? "animate-toast-in" : "opacity-0"
      }`}
      role="alert"
    >
      <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`mb-1 text-xs font-bold uppercase tracking-wide ${styles.labelClass}`}
        >
          {heading}
        </p>
        <p className="font-semibold">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className={`ml-1 shrink-0 rounded-full p-1.5 text-base font-bold ${styles.buttonClass}`}
        aria-label="Đóng"
      >
        ×
      </button>
    </div>
  );
}

export function showSuccessToast(message: string) {
  const id = buildToastId("success", message);
  scheduleAutoDismiss(id, SUCCESS_TOAST_DURATION_MS);
  return toast.custom(
    (t: Toast) => (
      <EmphasisToast t={t} variant="success" message={message} />
    ),
    { id, duration: SUCCESS_TOAST_DURATION_MS },
  );
}

export type ErrorToastOptions = {
  /** @deprecated Giữ tương thích API; mọi toast error dùng cùng style nổi bật */
  emphasis?: boolean;
  durationMs?: number;
};

export function showErrorToast(message: string, options?: ErrorToastOptions) {
  const id = buildToastId("error", message);
  const duration = options?.durationMs ?? ERROR_TOAST_DURATION_MS;
  scheduleAutoDismiss(id, duration);

  return toast.custom(
    (t: Toast) => <EmphasisToast t={t} variant="error" message={message} />,
    { id, duration },
  );
}

export function showNotificationToast(
  title: string,
  message: string,
  notificationId: string,
) {
  const id = `notification:${notificationId}`;
  scheduleAutoDismiss(id, NOTIFICATION_TOAST_DURATION_MS);
  return toast.custom(
    (t: Toast) => (
      <EmphasisToast
        t={t}
        variant="info"
        label={title}
        message={message}
      />
    ),
    { id, duration: NOTIFICATION_TOAST_DURATION_MS },
  );
}
