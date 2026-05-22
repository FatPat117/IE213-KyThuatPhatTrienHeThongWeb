'use client';

import { useRef } from 'react';
import Link from 'next/link';
import CreateCampaignStatusAlerts from './CreateCampaignStatusAlerts';

interface CreateCampaignFormProps {
  formData: {
    title: string;
    description: string;
    goalEth: string;
    deadline: string;
    reviewerSafe: string;
    beneficiary: string;
  };
  reviewerOptions: Array<{ value: string; label: string }>;
  formErrors: Record<string, string>;
  isBusy: boolean;
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  etherscanLink: string | null;
  errorMessage: string | null;
  /** Preview URL (object URL or cloudinary URL) for the selected thumbnail */
  thumbnailPreview: string | null;
  /** Upload progress 0-100, or null when not uploading */
  thumbnailUploadProgress: number | null;
  /** Error message from thumbnail upload attempt */
  thumbnailUploadError: string | null;
  onFieldChange: (name: string, value: string) => void;
  onThumbnailFileChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent) => void;
}

/**
 * Main create campaign form. Keeps render concerns separate from page orchestration.
 */
export default function CreateCampaignForm({
  formData,
  reviewerOptions,
  formErrors,
  isBusy,
  status,
  txHash,
  etherscanLink,
  errorMessage,
  thumbnailPreview,
  thumbnailUploadProgress,
  thumbnailUploadError,
  onFieldChange,
  onThumbnailFileChange,
  onSubmit,
}: CreateCampaignFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        {formErrors.title && <p className="mt-2 text-sm text-red-600">  {formErrors.title}</p>}
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
        {formErrors.description && <p className="mt-2 text-sm text-red-600">  {formErrors.description}</p>}
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
          {formErrors.goalEth && <p className="mt-2 text-sm text-red-600">  {formErrors.goalEth}</p>}
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
          {formErrors.deadline && <p className="mt-2 text-sm text-red-600">  {formErrors.deadline}</p>}
          <p className="mt-2 text-xs text-slate-500">Tối đa: 1 năm từ hiện tại</p>
        </div>
      </div>

      {/* Thumbnail Upload */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Ảnh thumbnail chiến dịch
        </label>
        <div
          className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition bg-slate-50 hover:bg-slate-100 border-slate-300 hover:border-blue-400"
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            if (isBusy) return;
            const file = e.dataTransfer.files?.[0];
            if (file) onThumbnailFileChange(file);
          }}
        >
          {thumbnailPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailPreview}
              alt="Thumbnail preview"
              className="absolute inset-0 h-full w-full object-cover rounded-xl opacity-90"
            />
          ) : (
            <div className="text-center px-4">
              <span className="text-4xl">🖼️</span>
              <p className="mt-2 text-sm font-medium text-slate-600">Kéo thả hoặc click để chọn ảnh</p>
              <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP, GIF · tối đa 5MB</p>
            </div>
          )}
          {thumbnailPreview && (
            <div className="absolute inset-0 flex items-end justify-end p-2 rounded-xl">
              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => { e.stopPropagation(); onThumbnailFileChange(null); }}
                className="rounded-full bg-white/90 border border-slate-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 shadow"
              >
                Xoá ảnh
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onThumbnailFileChange(file);
            // Reset so same file can be re-picked after clearing
            e.target.value = '';
          }}
        />
        {thumbnailUploadProgress !== null && thumbnailUploadProgress < 100 && (
          <div className="mt-2">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                style={{ width: `${thumbnailUploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Đang tải lên... {thumbnailUploadProgress}%</p>
          </div>
        )}
        {thumbnailUploadError && (
          <p className="mt-1 text-xs text-red-600">  {thumbnailUploadError}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Ảnh sẽ được tải lên Cloudinary. Nếu không chọn, hệ thống sẽ dùng ảnh mặc định.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Địa chỉ ví kiểm duyệt <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            name="reviewerSafe"
            aria-label="Chọn ví reviewerSafe"
            value={formData.reviewerSafe}
            onChange={(event) => onFieldChange('reviewerSafe', event.target.value)}
            disabled={isBusy}
            className={`w-full appearance-none px-4 py-3 pr-10 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 text-sm ${
              formErrors.reviewerSafe ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
            }`}
          >
            {reviewerOptions.length === 0 && (
              <option value="">Chưa có ví reviewer khả dụng</option>
            )}
            {reviewerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            ▾
          </span>
        </div>
        {formErrors.reviewerSafe && <p className="mt-2 text-sm text-red-600">  {formErrors.reviewerSafe}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Chọn ví reviewerSafe đã có trong hệ thống để hạn chế nhập sai địa chỉ quá dài.
        </p>
      </div>

      {/* Beneficiary wallet */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Địa chỉ ví nhận tiền <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="beneficiary"
          value={formData.beneficiary}
          onChange={(event) => onFieldChange('beneficiary', event.target.value)}
          disabled={isBusy}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 text-slate-900 placeholder-slate-400 font-mono text-sm ${
            formErrors.beneficiary ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-slate-200'
          }`}
          placeholder="0x..."
          maxLength={42}
          spellCheck={false}
        />
        {formErrors.beneficiary && <p className="mt-2 text-sm text-red-600"> {formErrors.beneficiary}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Ví nhận tiền khi chiến dịch được phê duyệt. Mặc định sẽ là ví người tạo, có thể sửa thành ví bên thi công.
        </p>
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
