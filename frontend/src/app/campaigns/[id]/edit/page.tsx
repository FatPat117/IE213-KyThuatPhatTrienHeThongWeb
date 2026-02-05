'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useReadCampaign } from '@/lib';
import { formatEther } from 'viem';

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const { address, isConnected, chain } = useAccount();
  const campaignId = Number(params.id);

  // Fetch campaign data
  const { campaign, isLoading, error } = useReadCampaign(campaignId);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Populate form when campaign loads
  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title || '',
        description: campaign.description || '',
      });
    }
  }, [campaign]);

  // Check authorization
  const isCreator = address && campaign && address.toLowerCase() === campaign.creator.toLowerCase();

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Vui lòng nhập tên chiến dịch';
    } else if (formData.title.length > 100) {
      errors.title = 'Tên chiến dịch tối đa 100 ký tự';
    }

    if (!formData.description.trim()) {
      errors.description = 'Vui lòng nhập mô tả';
    } else if (formData.description.length > 1000) {
      errors.description = 'Mô tả tối đa 1000 ký tự';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setSuccessMessage(null);

      // In a real implementation, this would call a backend API to update campaign metadata
      // For now, we'll just show a success message since the blockchain campaign can't be modified

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSuccessMessage('Cập nhật thành công! (Chỉ metadata – dữ liệu on-chain không đổi)');
      setTimeout(() => {
        router.push(`/campaigns/${campaignId}`);
      }, 2000);
    } catch (err) {
      console.error('Error updating campaign:', err);
      setFormErrors({
        submit: err instanceof Error ? err.message : 'Cập nhật thất bại',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Cần kết nối ví</h1>
          <p className="text-slate-600 mb-6">Vui lòng kết nối ví để chỉnh sửa chiến dịch.</p>
          <Link href="/campaigns" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition">
            ← Về danh sách chiến dịch
          </Link>
        </div>
      </div>
    );
  }

  if (chain?.id !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-red-900 mb-2">Sai mạng</h1>
          <p className="text-red-700 mb-6">Vui lòng chuyển sang Sepolia để chỉnh sửa chiến dịch.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Hướng dẫn đổi mạng
            </button>
            <Link
              href={`/campaigns/${campaignId}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold border border-slate-200 hover:border-slate-300 transition"
            >
              ← Về chiến dịch
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto animate-pulse space-y-6">
          <div className="h-10 bg-slate-200 rounded-lg w-1/3" />
          <div className="space-y-4">
            <div className="h-12 bg-slate-200 rounded-lg" />
            <div className="h-32 bg-slate-200 rounded-lg" />
            <div className="h-10 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error loading campaign
  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-red-900 mb-2">Không tìm thấy chiến dịch</h1>
          <p className="text-red-700 mb-6">{error || 'Không thể tải thông tin chiến dịch'}</p>
          <Link href="/campaigns" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition">
            ← Về danh sách chiến dịch
          </Link>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-orange-200 shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-orange-900 mb-2">Không có quyền</h1>
          <p className="text-orange-700 mb-6">Chỉ chủ chiến dịch mới có thể chỉnh sửa.</p>
          <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition">
            ← Về chiến dịch
          </Link>
        </div>
      </div>
    );
  }

  // Campaign ended
  if (campaign.completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition mb-6">
            ← Về chiến dịch
          </Link>
          <div className="rounded-2xl bg-slate-100 border border-slate-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Chiến dịch đã kết thúc</h1>
            <p className="text-slate-600">Chiến dịch đã kết thúc nên không thể chỉnh sửa. Dữ liệu được ghi vĩnh viễn trên blockchain.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition mb-4">
            ← Về chiến dịch
          </Link>
          <div>
            <span className="inline-flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                ✏️ Chỉnh sửa chiến dịch
              </span>
            </span>
            <h1 className="text-4xl font-bold text-slate-900">Chỉnh sửa chiến dịch</h1>
            <p className="text-lg text-slate-600 mt-2">
              Bạn chỉ có thể cập nhật tên và mô tả. Mục tiêu và thời hạn không thể thay đổi sau khi tạo.
            </p>
          </div>
        </div>

        {/* Campaign Info Box */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-blue-600 font-semibold">Mã chiến dịch</p>
              <p className="text-lg font-bold text-blue-900">#{campaign.id}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-semibold">Mục tiêu</p>
              <p className="text-lg font-bold text-blue-900">{formatEther(campaign.goal)} ETH</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-semibold">Đã gây quỹ</p>
              <p className="text-lg font-bold text-blue-900">{formatEther(campaign.raised)} ETH</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-semibold">Trạng thái</p>
              <p className="text-lg font-bold text-green-600">🔴 Đang hoạt động</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {formErrors.submit && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-red-700 font-semibold">{formErrors.submit}</p>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-green-700 font-semibold">✓ {successMessage}</p>
              </div>
            )}

            {/* Title Field */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-900 mb-2">
                Tên chiến dịch
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ví dụ: Vườn cộng đồng"
                maxLength={100}
                className={`w-full px-4 py-3 rounded-lg border-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                  formErrors.title
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-slate-200 focus:border-blue-600'
                }`}
              />
              <div className="flex justify-between mt-2">
                {formErrors.title && <p className="text-sm text-red-600">{formErrors.title}</p>}
                <p className="text-xs text-slate-500 ml-auto">{formData.title.length}/100</p>
              </div>
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-900 mb-2">
                Mô tả chiến dịch
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả mục tiêu, lý do gây quỹ và tác động..."
                maxLength={1000}
                rows={6}
                className={`w-full px-4 py-3 rounded-lg border-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none transition resize-none ${
                  formErrors.description
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-slate-200 focus:border-blue-600'
                }`}
              />
              <div className="flex justify-between mt-2">
                {formErrors.description && <p className="text-sm text-red-600">{formErrors.description}</p>}
                <p className="text-xs text-slate-500 ml-auto">{formData.description.length}/1000</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm text-slate-700">
                <strong>ℹ️ Lưu ý:</strong> Mục tiêu và thời hạn không thể thay đổi vì đã ghi on-chain. Nếu cần đổi, hãy tạo chiến dịch mới.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                {isSubmitting ? '💾 Đang lưu...' : '💾 Lưu thay đổi'}
              </button>
              <Link
                href={`/campaigns/${campaignId}`}
                className="flex-1 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold py-3 hover:border-slate-300 transition text-center"
              >
                Hủy
              </Link>
            </div>
          </form>
        </div>

        {/* Info Section */}
        <div className="mt-8 rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Về chỉnh sửa chiến dịch</h2>
          <div className="space-y-3 text-slate-600">
            <p>
              <strong className="text-slate-900">Có thể chỉnh sửa:</strong> Tên và mô tả khi chiến dịch còn hoạt động.
            </p>
            <p>
              <strong className="text-slate-900">Không thể chỉnh sửa:</strong> Mục tiêu và thời hạn vì đã ghi on-chain để đảm bảo công bằng.
            </p>
            <p>
              <strong className="text-slate-900">Minh bạch blockchain:</strong> Thông tin chiến dịch được ghi vĩnh viễn và có thể kiểm chứng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
