'use client';

import toast, { Toast } from "react-hot-toast";

function buildToastId(kind: "success" | "error", message: string) {
  return `${kind}:${message.trim().toLowerCase()}`;
}

const ERROR_TOAST_DURATION_MS = 5500;
const SUCCESS_TOAST_DURATION_MS = 4000;
const NOTIFICATION_TOAST_DURATION_MS = 5000;

function scheduleAutoDismiss(toastId: string, durationMs: number) {
  const safeDuration =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 4000;
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
    labelClass: string;
    textClass: string;
    buttonClass: string;
    label: string;
  }
> = {
  success: {
    shell: "border border-[rgba(99,102,241,0.3)] bg-[rgba(13,20,38,0.95)] shadow-lg shadow-black/30 backdrop-blur-md",
    accent: "border-l-4 border-l-[var(--accent-cyan)]",
    label: "Thành công",
    labelClass: "text-[var(--accent-cyan)]",
    textClass: "text-[var(--text-primary)]",
    buttonClass: "text-[var(--text-secondary)] hover:bg-[rgba(99,102,241,0.15)]",
  },
  error: {
    shell: "border border-red-500/30 bg-[rgba(13,20,38,0.95)] shadow-lg shadow-black/30 backdrop-blur-md",
    accent: "border-l-4 border-l-red-500",
    label: "Lỗi",
    labelClass: "text-red-300",
    textClass: "text-[var(--text-primary)]",
    buttonClass: "text-[var(--text-secondary)] hover:bg-[rgba(239,68,68,0.12)]",
  },
  info: {
    shell: "border border-[rgba(99,102,241,0.3)] bg-[rgba(13,20,38,0.95)] shadow-lg shadow-black/30 backdrop-blur-md",
    accent: "border-l-4 border-l-[var(--accent-primary)]",
    label: "Thông báo",
    labelClass: "text-[var(--accent-primary)]",
    textClass: "text-[var(--text-primary)]",
    buttonClass: "text-[var(--text-secondary)] hover:bg-[rgba(99,102,241,0.15)]",
  },
};

function AppToast({
  t,
  variant,
  message,
  label,
}: {
  t: Toast;
  variant: ToastVariant;
  message: string;
  label?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  const heading = label ?? styles.label;

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm transition sm:max-w-md ${styles.shell} ${styles.accent} ${styles.textClass} ${
        t.visible ? "animate-toast-in" : "opacity-0"
      }`}
      role="alert"
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${styles.labelClass}`}
        >
          {heading}
        </p>
        <p className="mt-1 leading-snug">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className={`shrink-0 rounded-md px-2 py-1 text-lg leading-none ${styles.buttonClass}`}
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
    (t: Toast) => <AppToast t={t} variant="success" message={message} />,
    { id, duration: SUCCESS_TOAST_DURATION_MS },
  );
}

export type ErrorToastOptions = {
  /** @deprecated Giữ tương thích API */
  emphasis?: boolean;
  durationMs?: number;
};

export function showErrorToast(message: string, options?: ErrorToastOptions) {
  const id = buildToastId("error", message);
  const duration = options?.durationMs ?? ERROR_TOAST_DURATION_MS;
  scheduleAutoDismiss(id, duration);

  return toast.custom(
    (t: Toast) => <AppToast t={t} variant="error" message={message} />,
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
      <AppToast t={t} variant="info" label={title} message={message} />
    ),
    { id, duration: NOTIFICATION_TOAST_DURATION_MS },
  );
}
