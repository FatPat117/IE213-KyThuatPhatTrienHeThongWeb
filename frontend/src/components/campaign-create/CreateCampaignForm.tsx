'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import CampaignDescriptionFields from './CampaignDescriptionFields';
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
  reviewerOptions: Array<{
    value: string;
    organization: string;
    region: string;
  }>;
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

function fieldCounterClass(current: number, max: number): string {
  if (max <= 0) return 'field-counter';
  const ratio = current / max;
  if (ratio >= 0.95) return 'field-counter danger';
  if (ratio >= 0.8) return 'field-counter warning';
  return 'field-counter';
}

function inputClass(hasError: boolean): string {
  return `create-campaign-input ${hasError ? 'create-campaign-input-error' : ''}`;
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
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <form onSubmit={onSubmit} className="create-campaign-form-container">
      <div className="warning-banner">
        <span className="text-xl shrink-0" aria-hidden>
          ⚠️
        </span>
        <div>
          <p className="warning-banner-title">Lưu ý giao dịch blockchain</p>
          <p>
            Tạo chiến dịch là <strong>giao dịch không thể hoàn tác</strong>. Hãy
            kiểm tra kỹ trước khi gửi.
          </p>
        </div>
      </div>

      <h2 className="form-section-title">Thông tin cơ bản</h2>
      <div className="form-field-group">
        <label htmlFor="campaign-title" className="field-label">
          Tên chiến dịch <span className="text-red-400">*</span>
        </label>
        <p className="field-hint">
          Tên ngắn gọn, dễ nhớ — hiển thị trên danh sách và trang chi tiết.
        </p>
        <input
          id="campaign-title"
          type="text"
          name="title"
          value={formData.title}
          onChange={(event) => onFieldChange('title', event.target.value)}
          disabled={isBusy}
          className={inputClass(!!formErrors.title)}
          placeholder="Ví dụ: Quỹ cộng đồng cho trường học"
          maxLength={100}
        />
        {formErrors.title && (
          <p className="field-error">{formErrors.title}</p>
        )}
        <p className={fieldCounterClass(formData.title.length, 100)}>
          {formData.title.length}/100 ký tự
        </p>
      </div>

      <h2 className="form-section-title">Mô tả chi tiết</h2>
      <CampaignDescriptionFields
        value={formData.description}
        disabled={isBusy}
        error={formErrors.description ?? null}
        onChange={(composed) => onFieldChange('description', composed)}
      />

      <h2 className="form-section-title">Cài đặt & hình ảnh</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="form-field-group">
          <label htmlFor="campaign-goal" className="field-label">
            Mục tiêu gây quỹ <span className="text-red-400">*</span>
          </label>
          <p className="field-hint">Tối đa 1000 ETH</p>
          <div className="relative">
            <input
              id="campaign-goal"
              type="number"
              name="goalEth"
              value={formData.goalEth}
              onChange={(event) => onFieldChange('goalEth', event.target.value)}
              disabled={isBusy}
              step="0.001"
              min="0"
              className={`${inputClass(!!formErrors.goalEth)} pr-14`}
              placeholder="1.0"
            />
            <span className="create-campaign-suffix absolute right-4 top-1/2 -translate-y-1/2">
              ETH
            </span>
          </div>
          {formErrors.goalEth && (
            <p className="field-error">{formErrors.goalEth}</p>
          )}
        </div>

        <div className="form-field-group">
          <label htmlFor="campaign-deadline" className="field-label">
            Thời hạn chiến dịch <span className="text-red-400">*</span>
          </label>
          <p className="field-hint">Tối đa 1 năm từ hiện tại</p>
          <input
            id="campaign-deadline"
            type="datetime-local"
            name="deadline"
            value={formData.deadline}
            onChange={(event) => onFieldChange('deadline', event.target.value)}
            disabled={isBusy}
            min={new Date().toISOString().slice(0, 16)}
            aria-label="Chọn thời hạn chiến dịch"
            className={inputClass(!!formErrors.deadline)}
          />
          {formErrors.deadline && (
            <p className="field-error">{formErrors.deadline}</p>
          )}
        </div>
      </div>

      <div className="form-field-group">
        <span className="field-label">Ảnh thumbnail chiến dịch</span>
        <p className="field-hint">
          JPEG, PNG, WebP, GIF · tối đa 5MB. Không chọn thì dùng ảnh mặc định.
        </p>
        <div
          className={`upload-area relative flex h-48 w-full flex-col items-center justify-center ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
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
              className="absolute inset-0 h-full w-full rounded-[10px] object-cover opacity-90"
            />
          ) : (
            <div className="upload-area-text px-4 text-center">
              <span className="text-4xl" aria-hidden>
                🖼️
              </span>
              <p className="mt-2 text-sm">
                <strong>Kéo thả</strong> hoặc click để chọn ảnh
              </p>
            </div>
          )}
          {thumbnailPreview && (
            <div className="absolute inset-0 flex items-end justify-end rounded-[10px] p-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  onThumbnailFileChange(null);
                }}
                className="rounded-full border border-red-400/40 bg-[rgba(10,15,30,0.85)] px-2.5 py-1 text-xs font-semibold text-red-300 backdrop-blur-sm transition hover:bg-red-500/20"
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
          aria-label="Chọn ảnh thumbnail chiến dịch"
          disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onThumbnailFileChange(file);
            e.target.value = '';
          }}
        />
        {thumbnailUploadProgress !== null && thumbnailUploadProgress < 100 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-200"
                style={{ width: `${thumbnailUploadProgress}%` }}
              />
            </div>
            <p className="field-hint mt-2 mb-0">
              Đang tải lên... {thumbnailUploadProgress}%
            </p>
          </div>
        )}
        {thumbnailUploadError && (
          <p className="field-error">{thumbnailUploadError}</p>
        )}
      </div>

      <div className="form-field-group">
        <label htmlFor="campaign-reviewer" className="field-label">
          Kiểm duyệt viên phụ trách <span className="text-red-400">*</span>
        </label>
        <p className="field-hint">
          Chọn tổ chức và khu vực phù hợp với chiến dịch của bạn.
        </p>
        <div className="relative">
          <select
            id="campaign-reviewer"
            name="reviewerSafe"
            aria-label="Chọn kiểm duyệt viên phụ trách"
            value={formData.reviewerSafe}
            onChange={(event) => onFieldChange('reviewerSafe', event.target.value)}
            disabled={isBusy}
            className={inputClass(!!formErrors.reviewerSafe)}
          >
            {reviewerOptions.length === 0 && (
              <option value="">Chưa có kiểm duyệt viên khả dụng</option>
            )}
            {reviewerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.organization} — {option.region}
              </option>
            ))}
          </select>
          <span
            className="create-campaign-suffix pointer-events-none absolute inset-y-0 right-4 flex items-center"
            aria-hidden
          >
            ▾
          </span>
        </div>
        {formErrors.reviewerSafe && (
          <p className="field-error">{formErrors.reviewerSafe}</p>
        )}
        {formData.reviewerSafe &&
          (() => {
            const selected = reviewerOptions.find(
              (o) => o.value === formData.reviewerSafe,
            );
            if (!selected) return null;
            return (
              <div className="reviewer-selected-card">
                <p>
                  <strong>Đơn vị kiểm duyệt đã chọn</strong>
                </p>
                <p className="mt-2">
                  <span className="text-slate-300">Tổ chức:</span>{' '}
                  {selected.organization}
                </p>
                <p className="mt-1">
                  <span className="text-slate-300">Vùng phụ trách:</span>{' '}
                  {selected.region}
                </p>
              </div>
            );
          })()}
      </div>

      <div className="form-field-group">
        <label htmlFor="campaign-beneficiary" className="field-label">
          Địa chỉ ví nhận tiền <span className="text-red-400">*</span>
        </label>
        <p className="field-hint">
          Ví nhận tiền khi chiến dịch được phê duyệt. Mặc định là ví người tạo,
          có thể đổi sang ví bên thi công.
        </p>
        <input
          id="campaign-beneficiary"
          type="text"
          name="beneficiary"
          value={formData.beneficiary}
          onChange={(event) => onFieldChange('beneficiary', event.target.value)}
          disabled={isBusy}
          className={`${inputClass(!!formErrors.beneficiary)} font-mono text-sm`}
          placeholder="0x..."
          maxLength={42}
          spellCheck={false}
        />
        {formErrors.beneficiary && (
          <p className="field-error">{formErrors.beneficiary}</p>
        )}
      </div>

      <CreateCampaignStatusAlerts
        status={status}
        txHash={txHash}
        etherscanLink={etherscanLink}
        errorMessage={errorMessage}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <button type="submit" disabled={isBusy} className="submit-btn flex-1">
          {isBusy ? '⏳ Đợi xác nhận từ ví...' : '🚀 Tạo chiến dịch'}
        </button>
        <Link href="/campaigns" className="cancel-btn sm:w-auto sm:shrink-0">
          Hủy
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="form-tip-card">
          💡 <strong>Gợi ý:</strong> Hãy đảm bảo có đủ ETH testnet để trả phí gas.
        </div>
        <div className="form-tip-card">
          🔒 <strong>Bảo mật:</strong> Ví ký giao dịch, không lưu private key.
        </div>
      </div>
    </form>
  );
}
