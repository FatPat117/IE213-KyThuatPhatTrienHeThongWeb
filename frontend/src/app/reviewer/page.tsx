'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatEther } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import {
  contractConfig,
  getMilestoneApprovalStatus,
  getPublicCampaignMilestones,
  getPublicCampaigns,
  useAuth,
} from '@/lib';
import type {
  MilestoneApprovalStatus,
  PublicCampaignItem,
  PublicCampaignMilestone,
} from '@/lib/api/campaigns';

type ReviewFilter = 'all' | 'pending' | 'processed';

type ReviewerCampaignRow = {
  campaign: PublicCampaignItem;
  pendingMilestones: PublicCampaignMilestone[];
  processedMilestones: PublicCampaignMilestone[];
};

const PENDING_STATUSES = new Set(['submitted', 'pending_verification', 'resubmittable']);
const PROCESSED_STATUSES = new Set(['approved', 'disbursed', 'failed', 'refunded', 'review_timeout', 'deadline_exceeded']);

const DEFAULT_APPROVAL_STATUS: MilestoneApprovalStatus = {
  safeAddress: '',
  required: 0,
  confirmed: 0,
  executed: false,
  signers: [],
  pendingTxHash: '',
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Đang chờ duyệt',
  pending_verification: 'Chờ xác minh',
  resubmittable: 'Cần nộp lại',
  approved: 'Đã phê duyệt',
  disbursed: 'Đã giải ngân',
  failed: 'Thất bại',
  refunded: 'Đã hoàn tiền',
  review_timeout: 'Quá hạn duyệt',
  deadline_exceeded: 'Quá hạn mốc',
};

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  pending_verification: 'bg-sky-100 text-sky-800 border-sky-200',
  resubmittable: 'bg-orange-100 text-orange-800 border-orange-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  disbursed: 'bg-teal-100 text-teal-800 border-teal-200',
  failed: 'bg-rose-100 text-rose-800 border-rose-200',
  refunded: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  review_timeout: 'bg-violet-100 text-violet-800 border-violet-200',
  deadline_exceeded: 'bg-slate-200 text-slate-700 border-slate-300',
};

const PRIMARY_FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'all', label: 'Tất cả mốc' },
  { value: 'pending', label: 'Đang chờ duyệt' },
  { value: 'processed', label: 'Đã xử lý' },
];

function collectMilestonesByFilter(row: ReviewerCampaignRow, filter: ReviewFilter) {
  if (filter === 'pending') return row.pendingMilestones;
  if (filter === 'processed') return row.processedMilestones;

  return [...row.pendingMilestones, ...row.processedMilestones].sort(
    (a, b) => a.milestoneId - b.milestoneId,
  );
}

function toApprovalKey(campaignId: number, milestoneId: number) {
  return `${campaignId}:${milestoneId}`;
}

function shortenAddress(value: string) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEth(wei: string) {
  try {
    const value = Number(formatEther(BigInt(wei || '0')));
    return value.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } catch {
    return '0,00';
  }
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

function getStatusBadge(status: string) {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function buildIpfsUrl(cid: string) {
  const normalized = (cid || '').trim();
  return normalized ? `https://ipfs.io/ipfs/${normalized}` : '';
}

function buildSignatureProgressLabel(status: MilestoneApprovalStatus) {
  if (!status.required || status.required <= 0) {
    return 'Chưa có đề xuất đang chờ trên Gnosis Safe';
  }

  const waiting = Math.max(status.required - status.confirmed, 0);
  if (status.executed) {
    return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - giao dịch đã được thực thi`;
  }

  if (waiting === 0) {
    return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - đã đủ chữ ký, chờ Safe thực thi`;
  }

  return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - đang chờ ${waiting} người nữa`;
}

function EvidenceCard({ cid, submittedAt }: { cid: string; submittedAt: string }) {
  const [kind, setKind] = useState<'loading' | 'image' | 'pdf' | 'other'>('loading');
  const evidenceUrl = useMemo(() => buildIpfsUrl(cid), [cid]);

  useEffect(() => {
    if (!evidenceUrl) {
      setKind('other');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    const detectKind = async () => {
      try {
        const headResponse = await fetch(evidenceUrl, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });

        const contentType = (headResponse.headers.get('content-type') || '').toLowerCase();
        if (contentType.startsWith('image/')) {
          setKind('image');
          return;
        }
        if (contentType.includes('application/pdf')) {
          setKind('pdf');
          return;
        }
        setKind('other');
      } catch {
        setKind('other');
      }
    };

    detectKind();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [evidenceUrl]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-600">CID</p>
      <p className="mt-1 break-all text-xs text-slate-700">{cid}</p>
      <p className="mt-2 text-xs text-slate-500">Nộp lúc: {formatDate(submittedAt)}</p>

      {kind === 'loading' && <p className="mt-2 text-xs text-slate-500">Đang xác định loại tệp...</p>}

      {kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={evidenceUrl}
          alt="Evidence preview"
          className="mt-2 h-40 w-full rounded-lg border border-slate-200 bg-white object-contain"
        />
      )}

      {kind === 'pdf' && (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          Mở PDF
        </a>
      )}

      {kind === 'other' && (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Mở tài liệu
        </a>
      )}
    </div>
  );
}

export default function ReviewerWorkspacePage() {
  const { address, isConnected } = useAccount();
  const { token, user } = useAuth();
  const { writeContractAsync } = useWriteContract();

  const walletAddress = useMemo(
    () => (user?.wallet || address || '').trim().toLowerCase(),
    [address, user?.wallet],
  );

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [rows, setRows] = useState<ReviewerCampaignRow[]>([]);
  const [approvalStatusMap, setApprovalStatusMap] = useState<Record<string, MilestoneApprovalStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const reviewerAddressArg = walletAddress ? (walletAddress as `0x${string}`) : undefined;

  const { data: reviewerIndex } = useReadContract({
    ...contractConfig,
    functionName: 'reviewerIndex',
    args: reviewerAddressArg ? [reviewerAddressArg] : undefined,
    query: {
      enabled: Boolean(reviewerAddressArg),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  const reviewerId = Number(reviewerIndex || 0n);

  const { data: reviewerRecord } = useReadContract({
    ...contractConfig,
    functionName: 'getReviewer',
    args: reviewerId > 0 ? [BigInt(reviewerId)] : undefined,
    query: {
      enabled: reviewerId > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: isActiveReviewer } = useReadContract({
    ...contractConfig,
    functionName: 'isActiveReviewer',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(walletAddress),
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  });

  const normalizedIsReviewer = Boolean(isActiveReviewer);
  const reviewerName = typeof reviewerRecord === 'object' && reviewerRecord && 'name' in reviewerRecord
    ? String((reviewerRecord as { name?: string }).name || '').trim()
    : '';
  const reviewerActive = typeof reviewerRecord === 'object' && reviewerRecord && 'active' in reviewerRecord
    ? Boolean((reviewerRecord as { active?: boolean }).active)
    : false;

  const loadReviewerCampaigns = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setErrorMessage(null);

      const campaignsResponse = await getPublicCampaigns({ page: 1, limit: 100, sort: 'updatedAt', order: 'desc' });
      const campaigns = campaignsResponse.items.filter((campaign) => {
        const safe = (campaign.reviewerSafe || '').trim().toLowerCase();
        return /^0x[a-f0-9]{40}$/.test(safe);
      });

      const milestonesResults = await Promise.allSettled(
        campaigns.map((campaign) => getPublicCampaignMilestones(campaign.onChainId)),
      );

      const nextRows: ReviewerCampaignRow[] = [];
      milestonesResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;

        const campaign = campaigns[index];
        const pendingMilestones = result.value.milestones.filter((milestone) => PENDING_STATUSES.has(milestone.status));
        const processedMilestones = result.value.milestones.filter((milestone) => PROCESSED_STATUSES.has(milestone.status));

        if (pendingMilestones.length === 0 && processedMilestones.length === 0) {
          return;
        }

        nextRows.push({
          campaign,
          pendingMilestones,
          processedMilestones,
        });
      });

      nextRows.sort((a, b) => {
        if (b.pendingMilestones.length !== a.pendingMilestones.length) {
          return b.pendingMilestones.length - a.pendingMilestones.length;
        }
        return new Date(b.campaign.createdAt).getTime() - new Date(a.campaign.createdAt).getTime();
      });

      setRows(nextRows);
      setLastUpdatedAt(new Date().toLocaleTimeString('vi-VN'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải danh sách chiến dịch reviewer');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [token]);

  const refreshApprovalStatuses = useCallback(async () => {
    if (!token || rows.length === 0) return;

    const pendingTargets = rows.flatMap((row) =>
      row.pendingMilestones.map((milestone) => ({
        campaignId: row.campaign.onChainId,
        milestoneId: milestone.milestoneId,
      })),
    );

    if (pendingTargets.length === 0) return;

    const statusResults = await Promise.allSettled(
      pendingTargets.map(async (target) => {
        const data = await getMilestoneApprovalStatus(target.campaignId, target.milestoneId, token);
        return {
          key: toApprovalKey(target.campaignId, target.milestoneId),
          data,
        };
      }),
    );

    setApprovalStatusMap((prev) => {
      const next = { ...prev };
      for (const result of statusResults) {
        if (result.status !== 'fulfilled') continue;
        next[result.value.key] = result.value.data;
      }
      return next;
    });
  }, [rows, token]);

  useEffect(() => {
    loadReviewerCampaigns();
  }, [loadReviewerCampaigns]);

  useEffect(() => {
    if (!normalizedIsReviewer || rows.length === 0) return;

    refreshApprovalStatuses();
    const timer = window.setInterval(() => {
      refreshApprovalStatuses();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [normalizedIsReviewer, refreshApprovalStatuses, rows.length]);

  const filteredRows = useMemo(() => {
    return rows
      .map((row) => {
        const milestones = collectMilestonesByFilter(row, filter);

        return {
          campaign: row.campaign,
          milestones,
        };
      })
      .filter((row) => row.milestones.length > 0);
  }, [filter, rows]);

  const handleApprove = useCallback(
    async (campaignId: number, milestoneId: number) => {
      if (!isConnected || !walletAddress) {
        setActionMessage('Vui lòng kết nối ví để gửi phê duyệt.');
        return;
      }
      if (!normalizedIsReviewer || (reviewerId > 0 && reviewerRecord && !reviewerActive)) {
        setActionMessage('Ví hiện tại không có quyền reviewer để phê duyệt milestone.');
        return;
      }

      const key = toApprovalKey(campaignId, milestoneId);
      setApprovingKey(key);
      setActionMessage(null);

      try {
        const txHash = await writeContractAsync({
          ...contractConfig,
          functionName: 'approveMilestone',
          args: [BigInt(campaignId), BigInt(milestoneId)],
        });

        setActionMessage(`Đã gửi giao dịch phê duyệt: ${txHash}`);
        await refreshApprovalStatuses();
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : 'Không thể gửi giao dịch phê duyệt');
      } finally {
        setApprovingKey(null);
      }
    },
    [
      isConnected,
      normalizedIsReviewer,
      refreshApprovalStatuses,
      reviewerActive,
      reviewerId,
      reviewerRecord,
      walletAddress,
      writeContractAsync,
    ],
  );

  const handleReject = useCallback(
    async (campaignId: number, milestoneId: number) => {
      const key = toApprovalKey(campaignId, milestoneId);

      if (!isConnected || !walletAddress) {
        setActionMessage('Vui lòng kết nối ví để gửi từ chối.');
        return;
      }

      if (!normalizedIsReviewer || (reviewerId > 0 && reviewerRecord && !reviewerActive)) {
        setActionMessage('Ví hiện tại không có quyền reviewer để từ chối milestone.');
        return;
      }

      setRejectingKey(key);
      setActionMessage(null);

      try {
        setActionMessage('Tính năng từ chối on-chain sẽ được mở khi smart contract hỗ trợ reject milestone.');
      } finally {
        setRejectingKey(null);
      }
    },
    [
      isConnected,
      normalizedIsReviewer,
      reviewerActive,
      reviewerId,
      reviewerRecord,
      walletAddress,
    ],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-4 animate-pulse">
          <div className="h-10 w-72 rounded bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f7] px-4 py-8 text-slate-900 md:px-8 md:py-12">
      <main className="mx-auto max-w-6xl space-y-7">
        <header className="px-1 py-2 md:py-4">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
                  Reviewer Dashboard
                </span>
                <span className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold text-emerald-700">
                  {normalizedIsReviewer ? 'Đã có quyền reviewer' : 'Chế độ chỉ xem dữ liệu'}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 md:text-[3.2rem]">
                Không gian kiểm duyệt viên
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Theo dõi mốc chiến dịch, kiểm tra bằng chứng và xử lý phê duyệt minh bạch trên blockchain.
              </p>

              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>Ví đăng nhập: {shortenAddress(walletAddress) || 'Chưa kết nối'}</p>
                <p>
                  Hồ sơ on-chain: {reviewerName || 'Đang tải...'} {reviewerActive ? '(active)' : reviewerId > 0 ? '(inactive)' : ''}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setFilter('pending')}
                  className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] transition hover:bg-indigo-700"
                >
                  Duyệt chiến dịch
                </button>
                <button
                  onClick={async () => {
                    await loadReviewerCampaigns();
                    await refreshApprovalStatuses();
                  }}
                  disabled={isRefreshing}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {isRefreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
                </button>
              </div>
            </div>

            <div className="w-full max-w-lg space-y-3 md:pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bộ lọc</p>

              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white/70 p-1.5">
                {PRIMARY_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      filter === option.value
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!normalizedIsReviewer && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Tài khoản hiện tại chưa có quyền kiểm duyệt on-chain. Bạn chỉ có thể xem dữ liệu.
            </div>
          )}
        </header>

        <div className="h-px w-full bg-slate-200/80" />

        {lastUpdatedAt && <p className="px-1 text-xs font-medium text-slate-500">Cập nhật lúc: {lastUpdatedAt}</p>}

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {actionMessage && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {actionMessage}
          </div>
        )}

        {filteredRows.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
            Không có mốc chiến dịch phù hợp với bộ lọc hiện tại.
          </div>
        )}

        <div className="space-y-6">
          {filteredRows.map((row) => {
            const milestones = row.milestones;

            return (
              <section
                key={row.campaign.onChainId}
                className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="w-full border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{row.campaign.title || `Campaign #${row.campaign.onChainId}`}</h2>
                        <p className="mt-1 text-sm text-slate-600">Campaign ID: #{row.campaign.onChainId}</p>
                        <p className="mt-1 text-sm text-slate-600">Reviewer Safe: {row.campaign.reviewerSafe || 'Chưa cài đặt'}</p>
                      </div>
                      <Link
                        href={`/campaigns/${row.campaign.onChainId}/milestones`}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Xem timeline
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6 pt-0">
                  {milestones.map((milestone) => {
                    const key = toApprovalKey(row.campaign.onChainId, milestone.milestoneId);
                    const approvalStatus = approvalStatusMap[key] || DEFAULT_APPROVAL_STATUS;
                    const isApproving = approvingKey === key;
                    const isRejecting = rejectingKey === key;
                    const isPendingMilestone = PENDING_STATUSES.has(milestone.status);
                    const hasEvidence = milestone.reportCids.length > 0;

                    return (
                      <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Mốc #{milestone.milestoneId}</span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadge(milestone.status)}`}>
                                {getStatusLabel(milestone.status)}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">{milestone.title || `Milestone #${milestone.milestoneId}`}</h3>
                            <p className="mt-1 text-sm text-slate-700">{milestone.description || 'Không có mô tả.'}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-600">
                            <p>Hạn: {formatDate(milestone.deadline)}</p>
                            <p className="mt-1">Số tiền mốc: <span className="font-semibold text-slate-800">{formatEth(milestone.amountWei)} ETH</span></p>
                          </div>
                        </div>

                        <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                          {buildSignatureProgressLabel(approvalStatus)}
                        </div>

                        {isPendingMilestone && (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleApprove(row.campaign.onChainId, milestone.milestoneId)}
                              disabled={isApproving || isRejecting || !hasEvidence}
                              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isApproving ? 'Đang gửi phê duyệt...' : 'Phê duyệt mốc'}
                            </button>

                            <button
                              onClick={() => handleReject(row.campaign.onChainId, milestone.milestoneId)}
                              disabled={isApproving || isRejecting}
                              className="rounded-xl border border-rose-600 bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRejecting ? 'Đang xử lý từ chối...' : 'Từ chối mốc'}
                            </button>
                          </div>
                        )}

                        {!hasEvidence && (
                          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Milestone chưa có bằng chứng nộp lên, tạm thời không thể phê duyệt.
                          </p>
                        )}

                        {hasEvidence && (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {milestone.reportCids.map((item) => (
                              <EvidenceCard
                                key={`${milestone.milestoneId}-${item.cid}`}
                                cid={item.cid}
                                submittedAt={item.submittedAt}
                              />
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
