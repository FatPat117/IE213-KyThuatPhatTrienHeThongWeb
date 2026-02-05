'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { formatEther } from 'viem';
import { contractConfig, useReadAllCampaigns } from '@/lib';

interface DonationRecord {
  campaignId: bigint;
  campaignName: string;
  amount: bigint;
  transactionHash: string;
  blockNumber: bigint;
  timestamp: number;
}

export default function MyDonationsPage() {
  const { address, isConnected, chain } = useAccount();
  const config = useConfig();
  const { campaigns } = useReadAllCampaigns();

  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch donation history
  useEffect(() => {
    const fetchDonations = async () => {
      if (!isConnected || !address || !config) {
        setDonations([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const publicClient = getPublicClient(config);
        if (!publicClient) {
          throw new Error('Không thể kết nối RPC');
        }

        // Get DonationReceived events for this wallet
        const logs = await publicClient.getLogs({
          address: contractConfig.address as `0x${string}`,
          event: {
            type: 'event',
            name: 'DonationReceived',
            inputs: [
              { type: 'uint256', indexed: true, name: 'campaignId' },
              { type: 'address', indexed: true, name: 'donor' },
              { type: 'uint256', indexed: false, name: 'amount' },
            ],
          },
          args: {
            donor: address,
          },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        // Get block timestamps for each donation
        const donationsWithTimestamp = await Promise.all(
          logs.map(async (log) => {
            const block = await publicClient.getBlock({
              blockNumber: log.blockNumber,
            });

            const campaignId = log.args.campaignId as bigint;
            const campaign = campaigns.find((c) => BigInt(c.id) === campaignId);

            return {
              campaignId,
              campaignName: campaign?.title || `Campaign #${campaignId}`,
              amount: log.args.amount as bigint,
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp) * 1000, // Convert to milliseconds
            };
          })
        );

        // Sort by timestamp (most recent first)
        donationsWithTimestamp.sort((a, b) => b.timestamp - a.timestamp);
        setDonations(donationsWithTimestamp);
      } catch (err) {
        console.error('Error fetching donations:', err);
        setError('Không thể tải lịch sử quyên góp. Vui lòng thử lại.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDonations();
  }, [address, isConnected, config, campaigns]);

  // Calculate total donated
  const totalDonated = donations.reduce((sum, donation) => {
    return sum + donation.amount;
  }, BigInt(0));

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
              Vui lòng kết nối ví để xem lịch sử quyên góp của bạn.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 <strong>Lưu ý:</strong> Lịch sử quyên góp sẽ được lấy từ blockchain Sepolia.
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

  if (chain?.id !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Sai mạng lưới
            </h1>
            <p className="text-slate-600 mb-4">
              Vui lòng chuyển sang mạng Sepolia để xem lịch sử quyên góp.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
              className="block w-full text-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Hướng dẫn chuyển mạng
            </button>
            <Link
              href="/campaigns"
              className="block text-center px-6 py-3 rounded-lg bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
            >
              ← Về chiến dịch
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
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
                  💝 Your Impact
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Quyên góp của tôi</h1>
            </div>
          </div>
          <p className="text-lg text-slate-600 ml-13">
            Theo dõi đóng góp và lịch sử giao dịch on-chain
          </p>
        </div>

        {/* Wallet Info & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Connected Wallet */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600 mb-2">Ví đang kết nối</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
              <code className="text-sm font-mono text-slate-900">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </code>
            </div>
          </div>

          {/* Total Donations */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600 mb-2">Số lần quyên góp</p>
            <p className="text-2xl font-bold text-slate-900">
              {donations.length}
            </p>
          </div>

          {/* Total Donated */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600 mb-2">Tổng số tiền</p>
            <p className="text-2xl font-bold text-green-600">
              {Number(formatEther(totalDonated)).toFixed(4)}{' '}
              <span className="text-base font-normal text-slate-600">ETH</span>
            </p>
          </div>
        </div>

        {/* Donations List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Lịch sử quyên góp</h2>
            {donations.length > 0 && (
              <span className="text-sm font-medium text-slate-600">
                {donations.length} transaction{donations.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-slate-50 border border-slate-200 p-6">
                  <div className="h-4 w-1/3 rounded bg-slate-200 mb-3" />
                  <div className="h-3 w-1/2 rounded bg-slate-200 mb-2" />
                  <div className="h-3 w-2/3 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-red-900 font-semibold mb-2">Không thể tải lịch sử</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && donations.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <span className="text-3xl">💸</span>
              </div>
              <p className="text-slate-900 font-semibold mb-2">Chưa có quyên góp</p>
              <p className="text-slate-600 mb-6">
                Bạn chưa quyên góp lần nào. Hãy bắt đầu ủng hộ chiến dịch ngay!
              </p>
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                Duyệt chiến dịch
              </Link>
            </div>
          )}

          {/* Donations List */}
          {!isLoading && !error && donations.length > 0 && (
            <div className="space-y-4">
              {donations.map((donation, index) => (
                <div
                  key={`${donation.transactionHash}-${index}`}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-6 hover:bg-slate-100 transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left: Campaign Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          href={`/campaigns/${donation.campaignId}`}
                          className="text-lg font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {donation.campaignName}
                        </Link>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          #{donation.campaignId.toString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        {new Date(donation.timestamp).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${donation.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                        >
                          Xem giao dịch →
                        </a>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                          Block #{donation.blockNumber.toString()}
                        </span>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-600">Số tiền</p>
                        <p className="text-2xl font-bold text-green-600">
                          {Number(formatEther(donation.amount)).toFixed(4)}
                        </p>
                        <p className="text-xs text-slate-500">ETH</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">💝</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blockchain Info */}
        <div className="mt-6 rounded-xl bg-white border border-slate-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-slate-600">XÁC THỰC TRÊN BLOCKCHAIN</p>
          </div>
          <p className="text-xs text-slate-500">
            Tất cả khoản quyên góp được ghi vĩnh viễn trên Ethereum Sepolia
          </p>
        </div>
      </div>
    </div>
  );
}
