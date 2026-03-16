'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decodeEventLog } from 'viem';
import { useAccount, useChainId, useWaitForTransactionReceipt } from 'wagmi';
import {
  contractConfig,
  createTransaction,
  saveCampaignMetadataToCache,
  updateCampaignMetadata,
  useAuth,
  useCreateCampaign,
} from '@/lib';
import { showErrorToast, showSuccessToast } from '@/lib/ui/toast';
import CreateCampaignForm from '@/components/campaign-create/CreateCampaignForm';
import CreateCampaignGuardCard from '@/components/campaign-create/CreateCampaignGuardCard';
import CreateCampaignHeader from '@/components/campaign-create/CreateCampaignHeader';
import CreateCampaignSuccessCard from '@/components/campaign-create/CreateCampaignSuccessCard';

const SEPOLIA_CHAIN_ID = 11155111;

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { token } = useAuth();
  const chainId = useChainId();
  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalEth: '1.0',
    deadline: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [manualError, setManualError] = useState<string | null>(null);
  const [metadataSynced, setMetadataSynced] = useState(false);

  const { createCampaign, hash, isPending, error: createError } = useCreateCampaign();
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const etherscanLink = useMemo(() => {
    if (!hash) return null;
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }, [hash]);

  // Decode created campaign id from on-chain event logs.
  const createdCampaignId = useMemo(() => {
    if (!receipt || !isConfirmed) return null;
    try {
      const candidateLogs = receipt.logs.filter(
        (log) => log.address?.toLowerCase() === (contractConfig.address as string).toLowerCase()
      );
      for (const log of candidateLogs) {
        try {
          const decoded = decodeEventLog({
            abi: contractConfig.abi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'CampaignCreated') {
            const campaignId = Number(decoded.args.id);
            if (!Number.isNaN(campaignId)) return campaignId;
          }
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.error('Failed to decode CampaignCreated event', err);
    }
    return null;
  }, [receipt, isConfirmed]);

  const parsedCreateError = useMemo(() => {
    if (!createError?.message) return null;
    const msg = createError.message.toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied')) return 'Bạn đã từ chối giao dịch.';
    if (
      msg.includes('does not match the target chain') ||
      msg.includes('expected chain id') ||
      msg.includes('wrong network') ||
      msg.includes('chain id')
    ) {
      return 'Sai mạng. Vui lòng chuyển ví sang Sepolia trước khi tạo chiến dịch.';
    }
    if (msg.includes('insufficient funds')) {
      return 'Không đủ ETH để trả phí gas. Vui lòng kiểm tra số dư.';
    }
    if (msg.includes('network') || msg.includes('rpc')) return 'Lỗi mạng/RPC. Vui lòng kiểm tra kết nối.';
    return createError.message;
  }, [createError]);

  const transactionError = manualError || parsedCreateError;
  const transactionStatus: 'idle' | 'pending' | 'confirming' | 'success' | 'error' = transactionError
    ? 'error'
    : isConfirmed
      ? 'success'
      : isConfirming
        ? 'confirming'
        : isPending
          ? 'pending'
          : 'idle';
  const isFormBusy = isPending || isConfirming;

  useEffect(() => {
    if (!hash || !address) return;
    createTransaction(token, {
      txHash: hash,
      walletAddress: address,
      action: 'createCampaign',
      campaignOnChainId: createdCampaignId ?? undefined,
    }).catch(() => {
      // Keep UI flow unaffected if transaction indexing fails.
    });
  }, [address, createdCampaignId, hash, token]);

  useEffect(() => {
    if (!isConfirmed || !createdCampaignId) return;
    saveCampaignMetadataToCache(createdCampaignId, {
      title: formData.title,
      description: formData.description,
    });
  }, [createdCampaignId, formData.description, formData.title, isConfirmed]);

  useEffect(() => {
    if (!isConfirmed || !createdCampaignId || metadataSynced || !token) return;
    updateCampaignMetadata(createdCampaignId, token, {
      title: formData.title.trim(),
      description: formData.description,
    })
      .then(() => setMetadataSynced(true))
      .catch(() => {
        // Metadata sync is best-effort. User can retry from edit page later.
      });
  }, [createdCampaignId, formData.description, formData.title, isConfirmed, metadataSynced, token]);

  useEffect(() => {
    if (transactionStatus !== 'success') return;
    showSuccessToast('Tạo chiến dịch thành công! Đang chuyển tới trang chi tiết...');
    const target = createdCampaignId !== null ? `/campaigns/${createdCampaignId}` : '/campaigns';
    const timer = setTimeout(() => router.push(target), 3000);
    return () => clearTimeout(timer);
  }, [createdCampaignId, router, transactionStatus]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Vui lòng nhập tên chiến dịch';
    if (formData.title.length > 100) errors.title = 'Tên chiến dịch tối đa 100 ký tự';
    if (!formData.description.trim()) errors.description = 'Vui lòng nhập mô tả';
    if (formData.description.length > 1000) errors.description = 'Mô tả tối đa 1000 ký tự';

    const goal = parseFloat(formData.goalEth);
    if (!formData.goalEth || Number.isNaN(goal)) errors.goalEth = 'Mục tiêu gây quỹ phải là số hợp lệ';
    if (goal <= 0) errors.goalEth = 'Mục tiêu gây quỹ phải lớn hơn 0';
    if (goal > 1000) errors.goalEth = 'Mục tiêu gây quỹ không vượt quá 1000 ETH';

    if (!formData.deadline) {
      errors.deadline = 'Vui lòng chọn thời hạn';
    } else {
      const deadline = new Date(formData.deadline).getTime();
      const now = Date.now();
      if (deadline <= now) errors.deadline = 'Thời hạn phải ở tương lai';
      if (deadline > now + 365 * 24 * 60 * 60 * 1000) errors.deadline = 'Thời hạn không vượt quá 1 năm';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    if (manualError) setManualError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isConnected) {
      const msg = 'Vui lòng kết nối ví trước.';
      setManualError(msg);
      showErrorToast(msg);
      return;
    }
    if (!isSepoliaNetwork) {
      const msg = 'Vui lòng chuyển sang Sepolia để tạo chiến dịch.';
      setManualError(msg);
      showErrorToast(msg);
      return;
    }
    if (!address) {
      const msg = 'Không tìm thấy địa chỉ ví. Vui lòng kết nối lại ví.';
      setManualError(msg);
      showErrorToast(msg);
      return;
    }
    if (!validateForm()) return;

    try {
      setManualError(null);
      const deadlineTs = Math.floor(new Date(formData.deadline).getTime() / 1000);
      const nowTs = Math.floor(Date.now() / 1000);
      const durationDays = Math.ceil((deadlineTs - nowTs) / (24 * 60 * 60));
      await createCampaign(address as `0x${string}`, formData.goalEth, Math.max(durationDays, 1));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      const normalized = message.toLowerCase();
      if (
        normalized.includes('does not match the target chain') ||
        normalized.includes('expected chain id') ||
        normalized.includes('wrong network') ||
        normalized.includes('chain id')
      ) {
        const msg = 'Sai mạng. Vui lòng chuyển ví sang Sepolia trước khi tạo chiến dịch.';
        setManualError(msg);
        showErrorToast(msg);
        return;
      }
      setManualError(message);
      showErrorToast(message);
    }
  };

  if (!isConnected) {
    return (
      <CreateCampaignGuardCard
        icon="🔐"
        title="Cần kết nối ví"
        description="Vui lòng kết nối ví để tạo chiến dịch trên blockchain."
        tone="warning"
        helperTitle="💡 Lưu ý"
        helperText="Cần MetaMask hoặc ví Web3 để tạo chiến dịch và tương tác contract."
      />
    );
  }

  if (!isSepoliaNetwork) {
    return (
      <CreateCampaignGuardCard
        icon="⚠️"
        title="Sai mạng"
        description="Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch."
        tone="error"
        helperTitle="Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)"
        helperText="Vui lòng cập nhật mạng trong MetaMask để tiếp tục."
        primaryActionLabel="Hướng dẫn đổi mạng"
        onPrimaryAction={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <CreateCampaignHeader />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {transactionStatus === 'success' ? (
            <CreateCampaignSuccessCard
              txHash={hash || ''}
              etherscanLink={etherscanLink}
              createdCampaignId={createdCampaignId}
            />
          ) : (
            <CreateCampaignForm
              formData={formData}
              formErrors={formErrors}
              isBusy={isFormBusy}
              status={transactionStatus}
              txHash={hash}
              etherscanLink={etherscanLink}
              errorMessage={transactionError}
              onFieldChange={handleFieldChange}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
