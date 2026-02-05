'use client';

import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { useEffect, useState } from "react";
import { contractConfig } from "@/lib";

interface CampaignItem {
  id: number;
  title: string;
  description: string;
  creator: string;
  goal: bigint;
  raised: bigint;
  deadline: number;
  completed: boolean;
  withdrawn: boolean;
}

function CampaignCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-3 w-2/5 rounded bg-slate-200" />
        <div className="h-3 w-3/5 rounded bg-slate-200" />
      </div>
      <div className="mt-5 h-2 w-full rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-32 rounded-lg bg-slate-200" />
    </div>
  );
}

export default function MyCampaignsPage() {
  const { address, isConnected, chain } = useAccount();
  const config = useConfig();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!isConnected || !address || !config) {
        setCampaigns([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const publicClient = getPublicClient(config);
        if (!publicClient) {
          throw new Error("Không thể kết nối RPC");
        }

        // Get CampaignCreated events filtered by creator
        const logs = await publicClient.getLogs({
          address: contractConfig.address as `0x${string}`,
          event: {
            type: "event",
            name: "CampaignCreated",
            inputs: [
              { type: "uint256", indexed: true, name: "campaignId" },
              { type: "address", indexed: true, name: "creator" },
              { type: "string", indexed: false, name: "title" },
              { type: "uint256", indexed: false, name: "goal" },
              { type: "uint256", indexed: false, name: "deadline" },
            ],
          } as any,
          fromBlock: "earliest",
          toBlock: "latest",
        });

        const userCreatedCampaignIds = logs
          .filter(
            (log: any) =>
              log.args.creator &&
              log.args.creator.toLowerCase() === address.toLowerCase()
          )
          .map((log: any) => Number(log.args.campaignId))
          .sort((a, b) => b - a);

        // Fetch campaign details for each ID
        const campaignDetails = await Promise.all(
          userCreatedCampaignIds.map(async (id) => {
            try {
              const result = await publicClient.readContract({
                address: contractConfig.address as `0x${string}`,
                abi: contractConfig.abi as any,
                functionName: "getCampaign",
                args: [BigInt(id)],
              });

              if (result) {
                const campaign = result as any;
                return {
                  id,
                  title: campaign.title || "",
                  description: campaign.description || "",
                  creator: campaign.creator || "",
                  goal: campaign.goal || BigInt(0),
                  raised: campaign.raised || BigInt(0),
                  deadline: Number(campaign.deadline || 0),
                  completed: campaign.completed || false,
                  withdrawn: campaign.withdrawn || false,
                };
              }
              return null;
            } catch (err) {
              console.error(`Error fetching campaign ${id}:`, err);
              return null;
            }
          })
        );

        const validCampaigns = campaignDetails.filter(
          (c) => c !== null
        ) as CampaignItem[];
        setCampaigns(validCampaigns);
      } catch (err) {
        console.error("Error fetching campaigns:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải chiến dịch của bạn"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [address, isConnected, config]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
        <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Chưa kết nối ví
            </h2>
            <p className="text-slate-600 mb-6">
              Vui lòng kết nối ví để xem chiến dịch của bạn
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Về trang chủ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (chain?.id !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
        <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Sai mạng</h2>
            <p className="text-red-700 mb-6">Vui lòng chuyển sang Sepolia để xem chiến dịch.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.open("https://chainlist.org/?search=sepolia", "_blank")}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                Hướng dẫn đổi mạng
              </button>
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold border border-slate-200 hover:border-slate-300 transition"
              >
                Về danh sách chiến dịch
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
        {/* Page Header */}
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                  👤 My Campaigns
                </span>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-3">
                Chiến dịch bạn đã tạo
              </h1>
              <p className="text-lg text-slate-600">
                Quản lý và theo dõi các chiến dịch của bạn
              </p>
            </div>
            <Link
              href="/campaigns/create"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition duration-200 whitespace-nowrap"
            >
              + Tạo mới
            </Link>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && campaigns.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Chưa có chiến dịch
            </h2>
            <p className="text-slate-600 mb-6">
              Hãy tạo chiến dịch đầu tiên của bạn
            </p>
            <Link
              href="/campaigns/create"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Tạo chiến dịch đầu tiên
            </Link>
          </div>
        )}

        {/* Campaigns Grid */}
        {!isLoading && campaigns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const goalEth = parseFloat(formatEther(campaign.goal));
              const raisedEth = parseFloat(formatEther(campaign.raised));
              const progress = goalEth > 0 ? (raisedEth / goalEth) * 100 : 0;
              const timeLeft =
                campaign.deadline - Math.floor(Date.now() / 1000);
              const isActive = timeLeft > 0 && !campaign.completed;
              const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60));

              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  {/* Status Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="inline-flex items-center gap-2">
                      {isActive && (
                        <span className="text-xs font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                          🔴 Đang hoạt động
                        </span>
                      )}
                      {campaign.completed && !campaign.withdrawn && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                          ✓ Hoàn thành
                        </span>
                      )}
                      {campaign.withdrawn && (
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                          💰 Đã rút
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Creator */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition line-clamp-2">
                    {campaign.title}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {campaign.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {raisedEth.toFixed(2)} / {goalEth.toFixed(2)} ETH
                      </span>
                      <span className="text-sm font-semibold text-blue-600">
                        {Math.min(progress, 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Deadline Info */}
                  {isActive && (
                    <p className="text-xs text-slate-600 mb-4">
                      ⏰ Còn {daysLeft} ngày
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-600 font-medium">
                        Người ủng hộ
                      </p>
                      <p className="text-lg font-bold text-slate-900">-</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium">
                        Trạng thái
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {isActive ? "Đang hoạt động" : campaign.withdrawn ? "Đã rút" : "Đã kết thúc"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 space-y-2">
                    <div className="w-full py-2 px-4 rounded-lg border-2 border-blue-600 text-blue-600 font-semibold text-center">
                      Xem chi tiết
                    </div>
                    {isActive && (
                      <Link
                        href={`/campaigns/${campaign.id}/edit`}
                        className="block text-center py-2 px-4 rounded-lg bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ✏️ Chỉnh sửa
                      </Link>
                    )}
                    {campaign.completed && !campaign.withdrawn && (
                      <div className="w-full py-2 px-4 rounded-lg bg-green-50 text-green-600 font-semibold text-center">
                        💰 Rút tiền (xem chi tiết)
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
