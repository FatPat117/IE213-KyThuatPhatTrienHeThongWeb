'use client';

import Link from 'next/link';
import { formatEther } from 'viem';
import type { TimelineMilestone, MilestoneStatus } from '@/lib/utils/milestone-plan';

interface MilestoneTimelineProps {
  milestones: TimelineMilestone[];
  campaignId: number;
  contractAddress: string;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function formatEthAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, '');
  return value.toFixed(2);
}

function getStatusMeta(status: MilestoneStatus) {
  switch (status) {
    case 'completed':
      return {
        label: 'Đã hoàn thành',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 ring-emerald-100',
        cardClass: 'border-emerald-100',
      };
    case 'in_progress':
      return {
        label: 'Đang thực hiện',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500 ring-blue-100',
        cardClass: 'border-blue-100',
      };
    case 'delayed':
      return {
        label: 'Trễ hạn',
        badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500 ring-rose-100',
        cardClass: 'border-rose-100',
      };
    default:
      return {
        label: 'Sắp tới',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400 ring-slate-100',
        cardClass: 'border-slate-200',
      };
  }
}

export default function MilestoneTimeline({ milestones, campaignId, contractAddress }: MilestoneTimelineProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Dòng thời gian giải ngân</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Cập nhật theo dữ liệu on-chain hiện tại
        </span>
      </div>

      <div className="relative ml-2 border-l-2 border-slate-200 pl-6">
        {milestones.map((milestone) => {
          const statusMeta = getStatusMeta(milestone.status);
          const milestoneTargetEth = Number(formatEther(milestone.targetAmountWei));

          return (
            <article
              key={milestone.id}
              className={`relative mb-6 rounded-xl border bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm last:mb-0 ${statusMeta.cardClass}`}
            >
              <span
                className={`absolute -left-[35px] top-6 h-4 w-4 rounded-full ring-4 ${statusMeta.dotClass}`}
                aria-hidden
              />

              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{milestone.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{milestone.description}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Hạn chót dự kiến</p>
                  <p className="font-semibold text-slate-900">{formatDate(milestone.expectedDate)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Mục tiêu tài chính mốc</p>
                  <p className="font-semibold text-slate-900">
                    {formatEthAmount(milestoneTargetEth)} ETH ({milestone.allocationPercent}%)
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Ngưỡng cộng dồn</p>
                  <p className="font-semibold text-slate-900">{milestone.cumulativePercent}% tổng quỹ</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Đường dẫn bằng chứng</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/campaigns/${campaignId}`} className="font-medium text-blue-600 hover:text-blue-700">
                    Lịch sử quyên góp trong campaign
                  </Link>
                  <a
                    href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Smart contract trên Sepolia Explorer
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
