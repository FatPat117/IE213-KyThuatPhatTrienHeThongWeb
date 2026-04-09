'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { decodeEventLog, parseEther } from 'viem';
import { useAccount, useChainId, useWaitForTransactionReceipt } from 'wagmi';
import {
  contractConfig,
  createTransaction,
  getCampaignIndexStatus,
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
import MilestoneBuilder from '@/components/campaign-create/MilestoneBuilder';

const SEPOLIA_CHAIN_ID = 11155111;
const BPS_DENOMINATOR = 10_000;

function mapGoalsToAllocationBps(goalWeiItems: bigint[]) {
  const totalGoalWei = goalWeiItems.reduce((sum, item) => sum + item, 0n);
  if (totalGoalWei <= 0n) {
    throw new Error('Tổng mục tiêu milestones phải lớn hơn 0.');
  }

  const baseBps: number[] = [];
  const remainders: Array<{ index: number; remainder: bigint }> = [];

  let assigned = 0;
  goalWeiItems.forEach((goalWei, index) => {
    if (goalWei <= 0n) {
      throw new Error(`Milestone ${index + 1} phải có mục tiêu > 0.`);
    }
    const numerator = goalWei * BigInt(BPS_DENOMINATOR);
    const floorBps = Number(numerator / totalGoalWei);
    const remainder = numerator % totalGoalWei;
    baseBps.push(floorBps);
    remainders.push({ index, remainder });
    assigned += floorBps;
  });

  let remaining = BPS_DENOMINATOR - assigned;
  remainders.sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });

  let pointer = 0;
  while (remaining > 0 && remainders.length > 0) {
    const target = remainders[pointer % remainders.length];
    baseBps[target.index] += 1;
    pointer += 1;
    remaining -= 1;
  }

  if (baseBps.some((item) => item <= 0)) {
    throw new Error('Có milestone quá nhỏ, allocationBps bị 0. Vui lòng tăng giá trị milestone.');
  }
  const totalBps = baseBps.reduce((sum, item) => sum + item, 0);
  if (totalBps !== BPS_DENOMINATOR) {
    throw new Error('Tổng allocationBps phải bằng 10,000.');
  }

  return baseBps;
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { token } = useAuth();
  const chainId = useChainId();
  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalEth: '1.0',
    deadline: '',
    reviewerSafe: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [manualError, setManualError] = useState<string | null>(null);
  const [metadataSynced, setMetadataSynced] = useState(false);
  const [metadataSyncError, setMetadataSyncError] = useState<string | null>(null);
  const [isMetadataSyncing, setIsMetadataSyncing] = useState(false);
  const [step, setStep] = useState<'basic' | 'milestones'>('basic');
  const [milestoneMetadata, setMilestoneMetadata] = useState<
    Array<{ name: string; description: string }>
  >([]);

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
            const campaignId = Number((decoded.args as { campaignId?: bigint }).campaignId);
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
      status: 'pending',
      campaignOnChainId: createdCampaignId ?? undefined,
    }).catch(() => {
      showErrorToast('Khong the ghi nhan transaction vao he thong theo doi.');
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
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      setIsMetadataSyncing(true);
      setMetadataSyncError(null);
      // Wait for backend to index the campaign event, then patch metadata.
      // This avoids the frequent 202 "not yet indexed" response.
      let indexed = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) return;
        try {
          const status = await getCampaignIndexStatus(createdCampaignId);
          if (status.indexed) {
            indexed = true;
            break;
          }
        } catch {
          // ignore and retry
        }
        await sleep(2500);
      }

      if (cancelled) return;
      if (!indexed) {
        const errorMessage =
          'Campaign đã lên chain nhưng backend chưa index kịp để cập nhật metadata. Vui lòng thử lại sau.';
        setMetadataSyncError(errorMessage);
        setIsMetadataSyncing(false);
        showErrorToast(errorMessage);
        return;
      }

      try {
        const normalizedTitle = formData.title.trim();
        const normalizedReviewerSafe = formData.reviewerSafe.trim().toLowerCase();
        const fallbackThumbnailUrl =
          `https://placehold.co/1200x630/png?text=${encodeURIComponent(normalizedTitle || `Campaign-${createdCampaignId}`)}`;

        await updateCampaignMetadata(createdCampaignId, token, {
          title: normalizedTitle,
          description: formData.description,
          thumbnailUrl: fallbackThumbnailUrl,
          reviewerSafe: normalizedReviewerSafe,
          milestones: milestoneMetadata.map((milestone, index) => ({
            milestoneId: index,
            title: milestone.name.trim(),
            description: milestone.description.trim(),
          })),
        });
        if (!cancelled) {
          setMetadataSynced(true);
          setIsMetadataSyncing(false);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Không thể cập nhật metadata campaign sau khi tạo.';
        if (!cancelled) {
          setMetadataSyncError(message);
          setIsMetadataSyncing(false);
          showErrorToast(message);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    createdCampaignId,
    formData.description,
    formData.reviewerSafe,
    formData.title,
    isConfirmed,
    metadataSynced,
    milestoneMetadata,
    token,
  ]);

  useEffect(() => {
    if (transactionStatus !== 'success' || !metadataSynced) return;
    showSuccessToast('Tạo chiến dịch thành công! Đang chuyển tới trang chi tiết...');
    const target = createdCampaignId !== null ? `/campaigns/${createdCampaignId}` : '/campaigns';
    const timer = setTimeout(() => router.push(target), 3000);
    return () => clearTimeout(timer);
  }, [createdCampaignId, metadataSynced, router, transactionStatus]);

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

    const reviewerSafe = formData.reviewerSafe.trim().toLowerCase();
    if (!reviewerSafe) errors.reviewerSafe = 'Vui lòng nhập địa chỉ reviewerSafe';
    else if (!/^0x[a-f0-9]{40}$/.test(reviewerSafe)) errors.reviewerSafe = 'Địa chỉ reviewerSafe không hợp lệ';

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
    setMetadataSynced(false);
    setMetadataSyncError(null);
    setIsMetadataSyncing(false);
    setStep('milestones');
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <CreateCampaignHeader />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-8 w-2/3 bg-slate-200 rounded" />
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-12 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  if (step === 'milestones' && transactionStatus !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <CreateCampaignHeader />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
            <MilestoneBuilder
              campaignInfo={{
                title: formData.title.trim() || 'Chiến dịch mới',
                totalGoal: Number.parseFloat(formData.goalEth || '0') || 0,
                campaignDeadline: formData.deadline,
              }}
              onBack={() => setStep('basic')}
              onSubmit={async (nextMilestones) => {
                try {
                  setMilestoneMetadata(
                    nextMilestones.map((milestone) => ({
                      name: milestone.name,
                      description: milestone.description,
                    }))
                  );
                  setManualError(null);

                  const fundingDeadline = Math.floor(new Date(formData.deadline).getTime() / 1000);
                  const reviewerSafe = formData.reviewerSafe.trim().toLowerCase();
                  const milestoneDeadlines = nextMilestones.map((milestone) =>
                    Math.floor(new Date(milestone.deadline).getTime() / 1000)
                  );
                  if (milestoneDeadlines.some((deadline) => deadline <= fundingDeadline)) {
                    throw new Error('Mọi deadline milestone phải sau funding deadline.');
                  }

                  const milestoneGoalWei = nextMilestones.map((milestone) =>
                    parseEther(String(milestone.goal))
                  );
                  const allocationBps = mapGoalsToAllocationBps(milestoneGoalWei);
                  const totalBps = allocationBps.reduce((sum, item) => sum + item, 0);
                  if (totalBps !== BPS_DENOMINATOR) {
                    throw new Error('Tổng allocationBps phải bằng 10,000.');
                  }

                  await createCampaign({
                    goalEth: formData.goalEth,
                    reviewerSafe: reviewerSafe as `0x${string}`,
                    fundingDeadline,
                    allocationBps,
                    deadlines: milestoneDeadlines,
                  });
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
                  setManualError(message);
                  showErrorToast(message);
                }
              }}
            />
          </div>
        </div>
      </div>
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
          {isMetadataSyncing && (
            <p className="mt-4 text-sm text-slate-600">
              Dang dong bo metadata campaign voi backend...
            </p>
          )}
          {metadataSyncError && (
            <p className="mt-4 text-sm text-red-600">
              {metadataSyncError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
