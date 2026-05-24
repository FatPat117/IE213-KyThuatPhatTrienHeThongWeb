'use client';

import { useSystemStatus } from '@/lib';
import { WalletBannerConnectButton } from './WalletBannerConnectButton';

export function SystemStatusDisplay() {
  const { status, clearStatus } = useSystemStatus();

  if (!status || status.type === 'wallet-disconnected') {
    return null;
  }

  const handleDismiss = () => {
    clearStatus();
  };

  const isHighAttention =
    status.type === 'wrong-network';

  // Banner styles based on status type
  const getBannerColors = () => {
    switch (status.type) {
      case 'wrong-network':
        return 'bg-red-100 border-red-600 text-red-950 shadow-[0_10px_40px_-8px_rgba(185,28,28,0.45)] ring-2 ring-red-500/60';
      case 'rpc-error':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'insufficient-gas':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getIconColor = () => {
    switch (status.type) {
      case 'wrong-network':
        return 'text-red-600';
      case 'rpc-error':
        return 'text-orange-600';
      case 'insufficient-gas':
        return 'text-amber-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  const getIcon = () => {
    switch (status.type) {
      case 'wrong-network':
        return (
          <svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        );
      case 'rpc-error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.111 16H5m3-4H5m10 11H9.969a2 2 0 01-1.997-2.04A4 4 0 015.528 15m13-2a2 2 0 00-2-2H9m11 4a2 2 0 012 2v4a2 2 0 01-2 2H9m11-10V7a2 2 0 00-2-2H9.969C8.882 5 8 5.895 8 7v4"
            />
          </svg>
        );
      case 'insufficient-gas':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-100 border-b-2 transition-all duration-200 motion-safe:animate-[status-banner-in_0.4s_ease-out] ${getBannerColors()}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className={`shrink-0 mt-0.5 ${getIconColor()} ${isHighAttention ? 'motion-safe:animate-pulse' : ''}`}
          >
            {getIcon()}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-6">
            <div className="min-w-0 pr-1">
              {status.title && (
                <h3
                  className={`mb-1.5 font-bold tracking-tight ${isHighAttention ? 'text-base sm:text-lg' : 'text-sm font-semibold'}`}
                >
                  {status.title}
                </h3>
              )}
              <p
                className={`leading-snug ${isHighAttention ? 'text-sm sm:text-base font-medium' : 'text-sm'}`}
              >
                {status.message}
              </p>
              {status.action && (
                <button
                  onClick={status.action.onClick}
                  className="mt-2 inline-flex items-center px-3 py-1 rounded text-xs font-semibold bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200"
                >
                  {status.action.label}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
