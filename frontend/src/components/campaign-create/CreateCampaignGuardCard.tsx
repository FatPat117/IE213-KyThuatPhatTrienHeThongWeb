'use client';

import Link from 'next/link';

interface CreateCampaignGuardCardProps {
  icon: string;
  title: string;
  description: string;
  tone: 'warning' | 'error';
  helperTitle?: string;
  helperText?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

/**
 * Shared guard-state card for not-connected / wrong-network screens.
 */
export default function CreateCampaignGuardCard({
  icon,
  title,
  description,
  tone,
  helperTitle,
  helperText,
  primaryActionLabel,
  onPrimaryAction,
}: CreateCampaignGuardCardProps) {
  const toneClasses =
    tone === 'error'
      ? {
          outer: 'border-red-200',
          iconBg: 'bg-red-100',
          helper: 'bg-red-50 border-red-200 text-red-800',
        }
      : {
          outer: 'border-slate-200',
          iconBg: 'bg-yellow-100',
          helper: 'bg-blue-50 border-blue-200 text-blue-800',
        };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className={`max-w-md mx-auto bg-white rounded-2xl border ${toneClasses.outer} shadow-lg p-8`}>
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${toneClasses.iconBg} mb-4`}>
            <span className="text-3xl">{icon}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-600">{description}</p>
        </div>

        {(helperTitle || helperText) && (
          <div className={`border rounded-lg p-4 mb-6 ${toneClasses.helper}`}>
            {helperTitle && <p className="text-sm font-semibold mb-2">{helperTitle}</p>}
            {helperText && <p className="text-xs">{helperText}</p>}
          </div>
        )}

        <div className="space-y-3">
          {primaryActionLabel && onPrimaryAction && (
            <button
              onClick={onPrimaryAction}
              className="block w-full text-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              {primaryActionLabel}
            </button>
          )}
          <Link
            href="/campaigns"
            className="block text-center px-6 py-3 rounded-lg bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
          >
            ← Về danh sách chiến dịch
          </Link>
        </div>
      </div>
    </div>
  );
}
