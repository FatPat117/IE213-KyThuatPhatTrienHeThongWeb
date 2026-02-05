'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCreateCampaign } from '@/lib';
import { decodeEventLog } from 'viem';
import { contractConfig } from '@/lib';

const SEPOLIA_CHAIN_ID = 11155111;

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalEth: '1.0',
    deadline: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contract hooks
  const { createCampaign, hash, isPending, error: createError } = useCreateCampaign();
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Transaction state
  const [transactionStatus, setTransactionStatus] = useState<
    'idle' | 'pending' | 'confirming' | 'success' | 'error'
  >('idle');
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<number | null>(null);

  // Etherscan link
  const etherscanLink = useMemo(() => {
    if (!hash) return null;
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }, [hash]);

  // Handle transaction state changes
  useEffect(() => {
    if (isPending) {
      setTransactionStatus('pending');
      setTransactionError(null);
    } else if (isConfirming) {
      setTransactionStatus('confirming');
    } else if (isConfirmed) {
      setTransactionStatus('success');
      setIsSubmitting(false);
    }
  }, [isPending, isConfirming, isConfirmed]);

  useEffect(() => {
    if (!receipt || !isConfirmed) return;
    try {
      const candidateLogs = receipt.logs.filter(
        (l) => l.address?.toLowerCase() === (contractConfig.address as string).toLowerCase()
      );
      for (const log of candidateLogs) {
        try {
          const decoded = decodeEventLog({
            abi: contractConfig.abi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'CampaignCreated') {
            const campaignId = Number(decoded.args.campaignId);
            if (!Number.isNaN(campaignId)) {
              setCreatedCampaignId(campaignId);
              break;
            }
          }
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      console.error('Failed to decode CampaignCreated event', err);
    }
  }, [receipt, isConfirmed]);

  // Handle contract errors
  useEffect(() => {
    if (createError) {
      let errorMessage = 'Giao dịch thất bại. Vui lòng thử lại.';

      // Parse error messages
      if (createError.message) {
        if (createError.message.includes('User rejected')) {
          errorMessage = 'Bạn đã từ chối giao dịch.';
        } else if (createError.message.includes('insufficient funds')) {
          errorMessage = 'Không đủ ETH để trả phí gas. Vui lòng kiểm tra số dư.';
        } else if (createError.message.includes('network')) {
          errorMessage = 'Lỗi mạng. Vui lòng kiểm tra kết nối.';
        } else {
          errorMessage = createError.message;
        }
      }

      setTransactionError(errorMessage);
      setTransactionStatus('error');
      setIsSubmitting(false);
    }
  }, [createError]);

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

    const goal = parseFloat(formData.goalEth);
    if (!formData.goalEth || isNaN(goal)) {
      errors.goalEth = 'Mục tiêu gây quỹ phải là số hợp lệ';
    } else if (goal <= 0) {
      errors.goalEth = 'Mục tiêu gây quỹ phải lớn hơn 0';
    } else if (goal > 1000) {
      errors.goalEth = 'Mục tiêu gây quỹ không vượt quá 1000 ETH';
    }

    if (!formData.deadline) {
      errors.deadline = 'Vui lòng chọn thời hạn';
    } else {
      const deadline = new Date(formData.deadline).getTime();
      const now = Date.now();
      if (deadline <= now) {
        errors.deadline = 'Thời hạn phải ở tương lai';
      }
      const maxDeadline = now + 365 * 24 * 60 * 60 * 1000; // 1 year
      if (deadline > maxDeadline) {
        errors.deadline = 'Thời hạn không vượt quá 1 năm';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check wallet connection
    if (!isConnected) {
      setTransactionError('Vui lòng kết nối ví trước.');
      return;
    }

    // Check network
    if (chain?.id !== 11155111) {
      setTransactionError('Vui lòng chuyển sang Sepolia để tạo chiến dịch.');
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setTransactionError(null);

      const deadlineTimestamp = Math.floor(
        new Date(formData.deadline).getTime() / 1000
      );

      await createCampaign(
        formData.title,
        formData.description,
        formData.goalEth,
        deadlineTimestamp
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setTransactionError(errorMessage);
      setTransactionStatus('error');
      setIsSubmitting(false);
    }
  };

  // Redirect on success
  useEffect(() => {
    if (transactionStatus === 'success') {
      const target = createdCampaignId !== null ? `/campaigns/${createdCampaignId}` : '/campaigns';
      const timer = setTimeout(() => {
        router.push(target);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [transactionStatus, router, createdCampaignId]);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Cần kết nối ví
            </h1>
            <p className="text-slate-600">
              Vui lòng kết nối ví để tạo chiến dịch trên blockchain.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 <strong>Lưu ý:</strong> Cần MetaMask hoặc ví Web3 để tạo chiến dịch và tương tác contract.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="block text-center px-6 py-3 rounded-lg bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
          >
            ← Về danh sách chiến dịch
          </Link>
        </div>
      </div>
    );
  }

  // Wrong network state
  if (!isSepoliaNetwork) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Sai mạng
            </h1>
            <p className="text-slate-600 mb-4">
              Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-2">Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)</p>
              <p className="text-xs">Vui lòng cập nhật mạng trong MetaMask để tiếp tục.</p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
              className="block w-full text-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Hướng dẫn đổi mạng
            </button>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border-2 border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 transition"
            >
              ←
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  🚀 Tạo chiến dịch
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Tạo chiến dịch
              </h1>
            </div>
          </div>
          <p className="text-lg text-slate-600 ml-13">
            Khởi chạy chiến dịch gây quỹ minh bạch trên Ethereum
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">

          {transactionStatus === 'success' ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-6 shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-green-900 mb-3">
                🎉 Tạo chiến dịch thành công!
              </h3>
              <p className="text-green-800 mb-6">
                Chiến dịch đã được ghi nhận trên Sepolia và sẵn sàng nhận đóng góp.
              </p>
              <div className="bg-white rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-slate-600 mb-1">Mã giao dịch</p>
                <code className="text-xs font-mono text-slate-900 break-all">{hash}</code>
              </div>
              {etherscanLink && (
                <a
                  href={etherscanLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition mb-4"
                >
                  Xem trên Etherscan
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-6l6-6m0 0l-6 6m6-6v12"
                    />
                  </svg>
                </a>
              )}
              <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                {createdCampaignId !== null && (
                  <Link
                    href={`/campaigns/${createdCampaignId}`}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
                  >
                    Xem chiến dịch vừa tạo
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                  <p className="text-sm">Đang chuyển hướng...</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Security Warning Banner */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">
                      ⚠️ Lưu ý giao dịch blockchain
                    </p>
                    <p className="text-xs text-amber-800">
                      Tạo chiến dịch là <strong>giao dịch không thể hoàn tác</strong>. Thông tin không thể sửa/xóa sau khi tạo. Hãy kiểm tra kỹ trước khi gửi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Tên chiến dịch <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900 placeholder-slate-400 ${
                    formErrors.title
                      ? 'border-red-500 focus:ring-red-100 focus:border-red-500'
                      : 'border-slate-200'
                  }`}
                  placeholder="Ví dụ: Quỹ cộng đồng cho trường học"
                  maxLength={100}
                />
                {formErrors.title && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>❌</span> {formErrors.title}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {formData.title.length}/100 ký tự
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Mô tả chiến dịch <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  rows={6}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900 placeholder-slate-400 resize-none ${
                    formErrors.description
                      ? 'border-red-500 focus:ring-red-100 focus:border-red-500'
                      : 'border-slate-200'
                  }`}
                  placeholder="Mô tả mục tiêu, lý do gây quỹ và cách sử dụng tiền. Càng minh bạch càng tạo niềm tin."
                  maxLength={1000}
                />
                {formErrors.description && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>❌</span> {formErrors.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {formData.description.length}/1000 ký tự
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Fundraising Goal */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Mục tiêu gây quỹ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="goalEth"
                      value={formData.goalEth}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      step="0.001"
                      min="0"
                      className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900 ${
                        formErrors.goalEth
                          ? 'border-red-500 focus:ring-red-100 focus:border-red-500'
                          : 'border-slate-200'
                      }`}
                      placeholder="1.0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      ETH
                    </span>
                  </div>
                  {formErrors.goalEth && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <span>❌</span> {formErrors.goalEth}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Tối đa: 1000 ETH
                  </p>
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Thời hạn chiến dịch <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    min={new Date().toISOString().slice(0, 16)}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-900 ${
                      formErrors.deadline
                        ? 'border-red-500 focus:ring-red-100 focus:border-red-500'
                        : 'border-slate-200'
                    }`}
                  />
                  {formErrors.deadline && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <span>❌</span> {formErrors.deadline}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Tối đa: 1 năm từ hiện tại
                  </p>
                </div>
              </div>

              {/* Transaction Status Messages */}
              {transactionStatus === 'pending' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full flex-shrink-0"></div>
                    <div>
                      <p className="text-blue-900 font-semibold mb-1">
                        ⏳ Đang chờ xác nhận từ ví...
                      </p>
                      <p className="text-blue-700 text-sm">
                        Vui lòng mở ví và xác nhận giao dịch.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {transactionStatus === 'confirming' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full flex-shrink-0 mt-0.5"></div>
                    <div className="flex-1">
                      <p className="text-blue-900 font-semibold mb-1">
                        🔄 Đang xác nhận trên blockchain...
                      </p>
                      <p className="text-blue-700 text-sm mb-3">
                        Quá trình này có thể mất 10-30 giây. Vui lòng chờ Sepolia xác nhận.
                      </p>
                      {hash && (
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <p className="text-xs font-medium text-slate-600 mb-1">Mã giao dịch:</p>
                          <code className="text-xs font-mono text-slate-900 break-all">{hash}</code>
                          <a
                            href={etherscanLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium mt-2"
                          >
                            Xem trên Etherscan →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {transactionStatus === 'error' && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-red-900 font-semibold mb-1">
                        ❌ Giao dịch thất bại
                      </p>
                      {transactionError && (
                        <p className="text-red-700 text-sm">
                          {transactionError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    transactionStatus === 'pending' ||
                    transactionStatus === 'confirming'
                  }
                  className={`flex-1 py-4 px-6 rounded-xl font-bold text-white text-lg transition-all duration-200 shadow-lg ${
                    isSubmitting ||
                    transactionStatus === 'pending' ||
                    transactionStatus === 'confirming'
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl active:scale-[0.98]'
                  }`}
                >
                  {isSubmitting || transactionStatus === 'pending'
                    ? '⏳ Đợi xác nhận từ ví...'
                    : transactionStatus === 'confirming'
                      ? '🔄 Đang xác nhận...'
                      : '🚀 Tạo chiến dịch'}
                </button>
                <Link
                  href="/campaigns"
                  className="sm:w-auto py-4 px-8 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all duration-200 text-center"
                >
                  Hủy
                </Link>
              </div>

              {/* Helper Info */}
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
          )}
        </div>
      </div>
    </div>
  );
}
