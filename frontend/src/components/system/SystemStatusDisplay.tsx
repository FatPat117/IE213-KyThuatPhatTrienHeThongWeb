'use client';

import { useEffect, useState } from 'react';
import { useSystemStatus } from '@/lib';

export function SystemStatusDisplay() {
  const { status, clearStatus } = useSystemStatus();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status) {
      setIsVisible(true);
    }
  }, [status]);

  if (!status || !isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => clearStatus(), 200);
  };

  // Banner styles based on status type
  const getBannerColors = () => {
    switch (status.type) {
      case 'wallet-disconnected':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'wrong-network':
        return 'bg-red-50 border-red-200 text-red-900';
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
      case 'wallet-disconnected':
        return 'text-yellow-600';
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
      case 'wallet-disconnected':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'wrong-network':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-200 ${getBannerColors()}`}
      role="alert"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 mt-0.5 ${getIconColor()}`}>
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0">
            {status.title && (
              <h3 className="text-sm font-semibold mb-1">
                {status.title}
              </h3>
            )}
            <p className="text-sm">
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

          {status.dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 inline-flex text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
              aria-label="Dismiss notification"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
