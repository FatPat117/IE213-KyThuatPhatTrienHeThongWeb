'use client';

import Link from 'next/link';
import CreateCampaignStatusAlerts from './CreateCampaignStatusAlerts';

interface CreateCampaignFormProps {
  formData: {
    title: string;
    description: string;
    goalEth: string;
    deadline: string;
  };
  formErrors: Record<string, string>;
  isBusy: boolean;
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  etherscanLink: string | null;
  errorMessage: string | null;
  onFieldChange: (name: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

/**
 * Main create campaign form. Keeps render concerns separate from page orchestration.
 */
export default function CreateCampaignForm({
  formData,
  formErrors,
  isBusy,
  status,
  txHash,
  etherscanLink,
  errorMessage,
  onFieldChange,
  onSubmit,
}: CreateCampaignFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-900 mb-1">⚠️ Lưu ý giao dịch blockchain</p>
            <p className="text-xs text-amber-800">
              Tạo chiến dịch là <strong>giao dịch không thể hoàn tác</strong>. Hãy kiểm tra kỹ trước khi gửi.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Tên chiến dịch <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={(event) => onFieldChange('title', event.target.value)}
          disabled={isBusy}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 placeholder-slate-400 ${
            formErrors.title ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
          }`}
          placeholder="Ví dụ: Quỹ cộng đồng cho trường học"
          maxLength={100}
        />
        {formErrors.title && <p className="mt-2 text-sm text-red-600">❌ {formErrors.title}</p>}
        <p className="mt-2 text-xs text-slate-500">{formData.title.length}/100 ký tự</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Mô tả chiến dịch <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={(event) => onFieldChange('description', event.target.value)}
          disabled={isBusy}
          rows={6}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 placeholder-slate-400 resize-none ${
            formErrors.description
              ? 'border-red-500 focus:ring-red-100 focus:border-red-500'
              : 'border-slate-200'
          }`}
          placeholder="Mô tả mục tiêu, lý do gây quỹ và cách sử dụng tiền."
          maxLength={1000}
        />
        {formErrors.description && <p className="mt-2 text-sm text-red-600">❌ {formErrors.description}</p>}
        <p className="mt-2 text-xs text-slate-500">{formData.description.length}/1000 ký tự</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Mục tiêu gây quỹ <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              name="goalEth"
              value={formData.goalEth}
              onChange={(event) => onFieldChange('goalEth', event.target.value)}
              disabled={isBusy}
              step="0.001"
              min="0"
              className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 ${
                formErrors.goalEth ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
              }`}
              placeholder="1.0"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">ETH</span>
          </div>
          {formErrors.goalEth && <p className="mt-2 text-sm text-red-600">❌ {formErrors.goalEth}</p>}
          <p className="mt-2 text-xs text-slate-500">Tối đa: 1000 ETH</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Thời hạn chiến dịch <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            name="deadline"
            value={formData.deadline}
            onChange={(event) => onFieldChange('deadline', event.target.value)}
            disabled={isBusy}
            min={new Date().toISOString().slice(0, 16)}
            aria-label="Chọn thời hạn chiến dịch"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 ${
              formErrors.deadline ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
            }`}
          />
          {formErrors.deadline && <p className="mt-2 text-sm text-red-600">❌ {formErrors.deadline}</p>}
          <p className="mt-2 text-xs text-slate-500">Tối đa: 1 năm từ hiện tại</p>
        </div>
      </div>

      <CreateCampaignStatusAlerts
        status={status}
        txHash={txHash}
        etherscanLink={etherscanLink}
        errorMessage={errorMessage}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="submit"
          disabled={isBusy}
          className={`flex-1 py-4 px-6 rounded-xl font-bold text-white text-lg transition-all duration-200 shadow-lg ${
            isBusy ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl active:scale-[0.98]'
          }`}
        >
          {isBusy ? '⏳ Đợi xác nhận từ ví...' : '🚀 Tạo chiến dịch'}
        </button>
        <Link
          href="/campaigns"
          className="sm:w-auto py-4 px-8 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all duration-200 text-center"
        >
          Hủy
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-600">
            💡 <strong className="text-slate-900">Gợi ý:</strong> Hãy đảm bảo có đủ ETH testnet để trả phí gas.
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-600">
            🔒 <strong className="text-slate-900">Bảo mật:</strong> Ví ký giao dịch, không lưu private key.
          </p>
        </div>
      </div>
    </form>
  );
}
