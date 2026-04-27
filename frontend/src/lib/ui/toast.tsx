'use client';

import toast, { Toast } from "react-hot-toast";

function buildToastId(kind: "success" | "error", message: string) {
  return `${kind}:${message.trim().toLowerCase()}`;
}

export function showSuccessToast(message: string) {
  const id = buildToastId("success", message);
  return toast.custom((t: Toast) => (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg">
      <span className="mt-0.5">✅</span>
      <div className="flex-1">{message}</div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="ml-2 rounded-full p-1 text-xs text-emerald-700 hover:bg-emerald-100"
      >
        ×
      </button>
    </div>
  ), { id });
}

export function showErrorToast(message: string) {
  const id = buildToastId("error", message);
  return toast.custom((t: Toast) => (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg">
      <span className="mt-0.5">⚠️</span>
      <div className="flex-1">{message}</div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="ml-2 rounded-full p-1 text-xs text-red-700 hover:bg-red-100"
      >
        ×
      </button>
    </div>
  ), { id });
}

