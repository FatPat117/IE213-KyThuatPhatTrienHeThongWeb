'use client';

import BackButton from '@/components/navigation/BackButton';

/**
 * Header section for the create campaign page.
 */
export default function CreateCampaignHeader() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <BackButton fallbackHref="/campaigns" />
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
              🚀 Tạo chiến dịch
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Tạo chiến dịch</h1>
        </div>
      </div>
      <p className="text-lg text-slate-600 ml-13">Khởi chạy chiến dịch gây quỹ minh bạch trên Ethereum</p>
    </div>
  );
}
