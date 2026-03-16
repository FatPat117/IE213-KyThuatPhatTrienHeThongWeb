'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  fallbackHref?: string;
  className?: string;
  preferFallback?: boolean;
}

/**
 * Unified back button:
 * - go to previous page when browser history exists
 * - fallback to a safe route when opened directly
 */
export default function BackButton({ fallbackHref = '/', className, preferFallback = false }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (preferFallback) {
      router.push(fallbackHref);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button
      onClick={handleBack}
      type="button"
      className={
        className ??
        'inline-flex items-center justify-center w-10 h-10 rounded-lg border-2 border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 transition'
      }
      aria-label="Quay lại"
      title="Quay lại"
    >
      ←
    </button>
  );
}
