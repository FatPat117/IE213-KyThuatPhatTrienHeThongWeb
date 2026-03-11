'use client';

import { formatEther } from 'viem';

interface CampaignInfoPanelProps {
  campaign: {
    id: number;
    title: string;
    description: string;
    creator: string;
    goal: bigint;
    raised: bigint;
    completed: boolean;
  };
  backendDescription?: string;
  backendTitle?: string;
  progress: number;
}

function formatEthAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, '');
  return value.toFixed(2);
}

/**
 * Main campaign overview block (title, creator, stats, progress).
 */
export default function CampaignInfoPanel({
  campaign,
  backendDescription,
  backendTitle,
  progress,
}: CampaignInfoPanelProps) {
  const goalEth = Number(formatEther(campaign.goal));
  const raisedEth = Number(formatEther(campaign.raised));

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            {backendTitle || campaign.title || `Campaign ${campaign.id}`}
          </h2>
          <p className="text-slate-600 leading-relaxed">
            {backendDescription ||
              campaign.description ||
              'This campaign is powered by smart contracts for transparent fundraising.'}
          </p>
        </div>
        <span
          className={`flex-shrink-0 ml-4 rounded-full px-4 py-2 text-sm font-bold ${
            campaign.completed ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'
          }`}
        >
          {campaign.completed ? 'Đã kết thúc' : '● Đang hoạt động'}
        </span>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 mb-6">
        <p className="text-sm font-medium text-slate-600 mb-1">Campaign Creator</p>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
          <code className="text-sm font-mono text-slate-900">
            {campaign.creator.slice(0, 6)}...{campaign.creator.slice(-4)}
          </code>
          <a
            href={`https://sepolia.etherscan.io/address/${campaign.creator}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View on Explorer →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-5">
          <p className="text-sm font-medium text-blue-600 mb-2">Funding Goal</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatEthAmount(goalEth)}{' '}
            <span className="text-base font-normal text-slate-600">ETH</span>
          </p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 p-5">
          <p className="text-sm font-medium text-green-600 mb-2">Total Raised</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatEthAmount(raisedEth)}{' '}
            <span className="text-base font-normal text-slate-600">ETH</span>
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-slate-900">{progress.toFixed(1)}% Funded</span>
          <span className="text-slate-600">
            {formatEthAmount(raisedEth)} / {formatEthAmount(goalEth)} ETH
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress >= 100 ? 'bg-green-500' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
