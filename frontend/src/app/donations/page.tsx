'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEther, parseAbiItem } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import DonationHistoryList from '@/components/donations/DonationHistoryList';
import DonationSummaryCards from '@/components/donations/DonationSummaryCards';
import BackButton from '@/components/navigation/BackButton';
import TransactionHistoryModal from '@/components/transactions/TransactionHistoryModal';
import type { DonationRecord } from '@/lib/api/types';
import { contractConfig, useBackendDonations, useBackendTransactions } from '@/lib';

export default function MyDonationsPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const [showTxModal, setShowTxModal] = useState(false);
  const [onChainDonations, setOnChainDonations] = useState<DonationRecord[]>([]);
  const [isOnChainLoading, setIsOnChainLoading] = useState(false);
  const donationQuery = useBackendDonations(address ?? null);
  const transactionQuery = useBackendTransactions(address ?? null);

  useEffect(() => {
    const fetchOnChainDonations = async () => {
      if (!address || !publicClient) return;

      try {
        setIsOnChainLoading(true);
        const logs = await publicClient.getLogs({
          address: contractConfig.address,
          event: parseAbiItem('event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount)'),
          args: { donor: address as `0x${string}` },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        const mapped = await Promise.all(
          logs.map(async (log) => {
            const campaignOnChainId = Number(log.args.campaignId ?? 0n);
            const amountWei = log.args.amount ?? 0n;
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            return {
              txHash: log.transactionHash ?? '',
              campaignOnChainId,
              donorWallet: address,
              amount: amountWei.toString(),
              amountEth: Number(formatEther(amountWei)),
              donatedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
            } satisfies DonationRecord;
          })
        );

        setOnChainDonations(
          mapped
            .filter((item) => item.txHash)
            .sort(
              (a, b) =>
                new Date(b.donatedAt).getTime() - new Date(a.donatedAt).getTime()
            )
        );
      } catch {
        setOnChainDonations([]);
      } finally {
        setIsOnChainLoading(false);
      }
    };

    fetchOnChainDonations();
  }, [address, publicClient]);

  const effectiveDonations = useMemo(() => {
    const byTxHash = new Map<string, DonationRecord>();

    [...donationQuery.data, ...onChainDonations].forEach((item) => {
      if (!item.txHash) return;
      byTxHash.set(item.txHash.toLowerCase(), item);
    });

    return Array.from(byTxHash.values()).sort(
      (a, b) => new Date(b.donatedAt).getTime() - new Date(a.donatedAt).getTime()
    );
  }, [donationQuery.data, onChainDonations]);

  const totalDonatedEth = useMemo(
    () => effectiveDonations.reduce((sum, donation) => sum + donation.amountEth, 0),
    [effectiveDonations]
  );

  const txItems = useMemo(
    () =>
      transactionQuery.data.map((tx) => ({
        txHash: tx.txHash,
        campaignId: tx.campaignOnChainId ?? undefined,
        campaignName: tx.campaignOnChainId ? `Campaign #${tx.campaignOnChainId}` : 'Unknown campaign',
        status: tx.status,
        timestamp: new Date(tx.updatedAt || tx.createdAt).getTime(),
      })),
    [transactionQuery.data]
  );

  const donationItems = useMemo(() => {
    const txStatusByHash = new Map(
      transactionQuery.data.map((tx) => [tx.txHash.toLowerCase(), tx.status] as const)
    );

    // If donation is already indexed from on-chain event, treat as success by default.
    return effectiveDonations.map((donation) => ({
      ...donation,
      status: txStatusByHash.get(donation.txHash.toLowerCase()) ?? 'success',
    }));
  }, [effectiveDonations, transactionQuery.data]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Cần kết nối ví</h1>
            <p className="text-slate-600">Vui lòng kết nối ví để xem lịch sử quyên góp của bạn.</p>
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
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sai mạng lưới</h1>
          <p className="text-slate-600 mb-4">Vui lòng chuyển sang mạng Sepolia để xem lịch sử quyên góp.</p>
          <button
            onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
            className="block w-full text-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Hướng dẫn chuyển mạng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BackButton fallbackHref="/" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Quyên góp của tôi</h1>
              <p className="text-lg text-slate-600">Đồng bộ từ backend indexer + blockchain events Donated</p>
            </div>
          </div>
        </div>

        {address && (
          <DonationSummaryCards
            wallet={address}
            donationCount={effectiveDonations.length}
            totalEth={totalDonatedEth.toFixed(4)}
          />
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Lịch sử quyên góp</h2>
            <button
              onClick={() => setShowTxModal(true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem transaction log
            </button>
          </div>

          {transactionQuery.error && (
            <p className="mb-4 text-xs text-amber-700">
              Không thể tải transaction log đầy đủ. Trạng thái donation hiển thị theo dữ liệu đã index.
            </p>
          )}
          {effectiveDonations.length > donationQuery.data.length && onChainDonations.length > 0 && (
            <p className="mb-4 text-xs text-blue-700">
              Đang bổ sung donation từ on-chain để bù phần backend index chưa đồng bộ kịp.
            </p>
          )}

          {(donationQuery.isLoading || isOnChainLoading) && (
            <p className="text-sm text-slate-600">Đang tải dữ liệu...</p>
          )}
          {!donationQuery.isLoading && donationQuery.error && (
            <p className="text-sm text-red-700">{donationQuery.error}</p>
          )}
          {!donationQuery.isLoading &&
            !donationQuery.error &&
            (donationItems.length > 0 ? (
              <DonationHistoryList donations={donationItems} />
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-900 font-semibold mb-2">Chưa có quyên góp</p>
                <Link
                  href="/campaigns"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                >
                  Duyệt chiến dịch
                </Link>
              </div>
            ))}
        </div>
      </div>

      <TransactionHistoryModal
        open={showTxModal}
        onClose={() => setShowTxModal(false)}
        title="Lịch sử giao dịch backend"
        transactions={txItems}
      />
    </div>
  );
}
