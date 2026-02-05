'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import { contractConfig, useDonateToCampaign, useReadCampaign, useWithdrawFunds, useRefundDonation } from "@/lib";

interface DonationEvent {
  campaignId: number;
  donor: string;
  amount: bigint;
  transactionHash: string;
  timestamp: number;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const { address, isConnected, chain } = useAccount();
  const id = Number(params?.id);
  const { campaign, isLoading, isError, error, refetch } = useReadCampaign(
    Number.isFinite(id) ? id : null
  );
  const [amount, setAmount] = useState("0.01");
  const [donations, setDonations] = useState<DonationEvent[]>([]);
  const { donate, hash, isPending, error: donateError } = useDonateToCampaign();
  const { withdrawFunds, hash: withdrawHash, isPending: withdrawPending, error: withdrawError } = useWithdrawFunds();
  const { refund, hash: refundHash, isPending: refundPending, error: refundError } = useRefundDonation();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } =
    useWaitForTransactionReceipt({
      hash: withdrawHash,
    });

  const { isLoading: refundConfirming, isSuccess: refundConfirmed } =
    useWaitForTransactionReceipt({
      hash: refundHash,
    });

  // Check if user is creator
  const isCreator = address && campaign && address.toLowerCase() === campaign.creator.toLowerCase();

  // Check if user has donated
  const userDonation = donations.find(d => d.donor.toLowerCase() === address?.toLowerCase());

  // Watch for donation events
  useWatchContractEvent({
    ...contractConfig,
    eventName: "DonationReceived",
    onLogs: (logs) => {
      // Add new donations to the list
      const newDonations = logs.map((log: any) => ({
        campaignId: Number(log.args.campaignId || 0),
        donor: log.args.donor || '',
        amount: log.args.amount || BigInt(0),
        transactionHash: log.transactionHash || '',
        timestamp: Date.now(),
      }));
      setDonations((prev) => [...newDonations, ...prev]);
      refetch();
    },
  });

  const explorerUrl = useMemo(() => {
    return hash ? `https://sepolia.etherscan.io/tx/${hash}` : null;
  }, [hash]);

  const getFriendlyError = (err?: { message?: string }) => {
    if (!err?.message) return null;
    const msg = err.message.toLowerCase();
    if (msg.includes("user rejected") || msg.includes("user denied")) {
      return "Bạn đã từ chối giao dịch.";
    }
    if (msg.includes("insufficient funds")) {
      return "Không đủ ETH để trả phí gas. Vui lòng nạp thêm ETH testnet.";
    }
    if (msg.includes("network") || msg.includes("rpc")) {
      return "Lỗi mạng/RPC. Vui lòng thử lại hoặc đổi RPC.";
    }
    if (msg.includes("wrong network") || msg.includes("chain")) {
      return "Sai mạng. Vui lòng chuyển sang Sepolia.";
    }
    return err.message;
  };

  useEffect(() => {
    if (isConfirmed) {
      refetch();
      setAmount("0.01"); // Reset amount after successful donation
    }
  }, [isConfirmed, refetch]);

  const handleDonate = () => {
    if (!Number.isFinite(id)) return;
    if (parseFloat(amount) <= 0) return;
    donate(id, amount);
  };

  const handleWithdraw = () => {
    if (!Number.isFinite(id)) return;
    withdrawFunds(id);
  };

  const handleRefund = () => {
    if (!Number.isFinite(id)) return;
    refund(id);
  };

  const progress = useMemo(() => {
    if (!campaign) return 0;
    const goalEth = Number(formatEther(campaign.goal));
    const raisedEth = Number(formatEther(campaign.raised));
    return goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
  }, [campaign]);

  const isSepolia = chain?.id === 11155111;
  const canDonate = Boolean(isConnected && isSepolia && campaign && !campaign.completed);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        {/* Page Header */}
        <header className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border-2 border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 transition"
              >
                ←
              </Link>
              <div>
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                    Campaign #{Number.isFinite(id) ? id : "-"}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Chi tiết chiến dịch</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
              <div className="h-8 w-2/3 rounded bg-slate-200 mb-4" />
              <div className="h-4 w-full rounded bg-slate-200 mb-2" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-lg font-semibold text-red-900 mb-2">Không thể tải chiến dịch</p>
            <p className="text-sm text-red-700 mb-4">{error || "Có lỗi xảy ra."}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Campaign Content */}
        {!isLoading && !isError && campaign && (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Left Column - Main Content */}
            <div className="space-y-6">
              {/* Campaign Info Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">
                      {campaign.title || `Campaign ${campaign.id}`}
                    </h2>
                    <p className="text-slate-600 leading-relaxed">
                      {campaign.description ||
                        "This campaign is powered by smart contracts for transparent fundraising."}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 ml-4 rounded-full px-4 py-2 text-sm font-bold ${
                      campaign.completed
                        ? "bg-slate-100 text-slate-600"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {campaign.completed ? "Ended" : "● Active"}
                  </span>
                </div>

                {/* Creator Info */}
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

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-5">
                    <p className="text-sm font-medium text-blue-600 mb-2">Funding Goal</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(formatEther(campaign.goal)).toFixed(2)}{" "}
                      <span className="text-base font-normal text-slate-600">ETH</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-green-50 border border-green-100 p-5">
                    <p className="text-sm font-medium text-green-600 mb-2">Total Raised</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Number(formatEther(campaign.raised)).toFixed(2)}{" "}
                      <span className="text-base font-normal text-slate-600">ETH</span>
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-900">{progress.toFixed(1)}% Funded</span>
                    <span className="text-slate-600">
                      {Number(formatEther(campaign.raised)).toFixed(2)} / {Number(formatEther(campaign.goal)).toFixed(2)} ETH
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress >= 100 ? "bg-green-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Donation History Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Lịch sử quyên góp</h3>
                  <span className="text-sm font-medium text-slate-600">
                    {donations.length} recent donation{donations.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {donations.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                      <span className="text-3xl">💝</span>
                    </div>
                    <p className="text-slate-600 mb-2">Chưa có quyên góp</p>
                    <p className="text-sm text-slate-500">Hãy là người đầu tiên ủng hộ!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {donations.map((donation, index) => (
                      <div
                        key={`${donation.transactionHash}-${index}`}
                        className="rounded-xl bg-slate-50 border border-slate-200 p-4 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600" />
                            <div>
                              <code className="text-sm font-mono text-slate-900">
                                {donation.donor.slice(0, 6)}...{donation.donor.slice(-4)}
                              </code>
                              <p className="text-xs text-slate-500">
                                {new Date(donation.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-green-600">
                            +{Number(formatEther(donation.amount)).toFixed(4)} ETH
                          </p>
                        </div>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${donation.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          View Transaction →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Donation Widget */}
            <div className="lg:sticky lg:top-6 h-fit space-y-4">
              {/* Creator Actions */}
              {isCreator && campaign.completed && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 p-8 shadow-xl text-white">
                  <h3 className="text-2xl font-bold mb-2">Hành động của chủ chiến dịch</h3>
                  <p className="text-purple-100 mb-6 text-sm">
                    Chiến dịch đã kết thúc. Thực hiện rút tiền gây quỹ.
                  </p>

                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawPending || withdrawConfirming || campaign.withdrawn}
                    className="w-full rounded-lg bg-white text-purple-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-purple-50 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white mb-4"
                  >
                    {withdrawPending
                      ? "⏳ Đợi xác nhận từ ví..."
                      : withdrawConfirming
                      ? "🔄 Đang xác nhận..."
                      : campaign.withdrawn
                      ? "✓ Đã rút"
                      : "💰 Rút tiền"}
                  </button>

                  {withdrawConfirmed && withdrawHash && (
                    <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white">
                      ✓ Rút tiền thành công!
                    </div>
                  )}
                  {withdrawError && (
                    <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">
                      ⚠️ {getFriendlyError(withdrawError) || "Rút tiền thất bại"}
                    </div>
                  )}
                  {withdrawHash && (
                    <a
                      className="block text-center text-sm font-medium text-purple-100 hover:text-white hover:underline mt-3"
                      href={`https://sepolia.etherscan.io/tx/${withdrawHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Xem trên Etherscan →
                    </a>
                  )}
                </div>
              )}

              {/* Donor Refund Actions */}
              {!isCreator && campaign.completed && !campaign.raised && userDonation && (
                <div className="rounded-2xl bg-gradient-to-br from-orange-600 to-orange-700 p-8 shadow-xl text-white">
                  <h3 className="text-2xl font-bold mb-2">Chiến dịch không đạt mục tiêu</h3>
                  <p className="text-orange-100 mb-6 text-sm">
                    Chiến dịch không đạt mục tiêu. Bạn có thể yêu cầu hoàn tiền.
                  </p>

                  <button
                    onClick={handleRefund}
                    disabled={refundPending || refundConfirming}
                    className="w-full rounded-lg bg-white text-orange-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-orange-50 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white mb-4"
                  >
                    {refundPending
                      ? "⏳ Đợi xác nhận từ ví..."
                      : refundConfirming
                      ? "🔄 Đang xác nhận..."
                      : "🔙 Yêu cầu hoàn tiền"}
                  </button>

                  {refundConfirmed && refundHash && (
                    <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white">
                      ✓ Hoàn tiền thành công! Vui lòng kiểm tra ví.
                    </div>
                  )}
                  {refundError && (
                    <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">
                      ⚠️ {getFriendlyError(refundError) || "Hoàn tiền thất bại"}
                    </div>
                  )}
                  {refundHash && (
                    <a
                      className="block text-center text-sm font-medium text-orange-100 hover:text-white hover:underline mt-3"
                      href={`https://sepolia.etherscan.io/tx/${refundHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Xem trên Etherscan →
                    </a>
                  )}
                </div>
              )}

              {/* Donate Widget */}
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 shadow-xl text-white">
                <h3 className="text-2xl font-bold mb-2">Ủng hộ chiến dịch</h3>
                <p className="text-blue-100 mb-6 text-sm">
                  Giao dịch sẽ được ghi nhận trên blockchain để minh bạch hoàn toàn
                </p>

                {!isConnected && (
                  <div className="mb-4 rounded-lg bg-white/10 border border-white/30 px-4 py-3 text-sm text-blue-100">
                    🔐 Vui lòng kết nối ví để quyên góp. Bạn vẫn có thể xem dữ liệu ở chế độ read-only.
                  </div>
                )}
                {isConnected && !isSepolia && (
                  <div className="mb-4 rounded-lg bg-yellow-500/20 border border-yellow-200/40 px-4 py-3 text-sm text-yellow-100">
                    ⚠️ Sai mạng. Vui lòng chuyển sang Sepolia để quyên góp.
                    <button
                      onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
                      className="ml-2 underline text-yellow-100 hover:text-white"
                    >
                      Hướng dẫn đổi mạng
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label className="text-sm font-semibold text-blue-100 mb-2 block">
                      Số tiền quyên góp (ETH)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        disabled={!canDonate}
                        className="w-full rounded-lg border-2 border-blue-400 bg-white/10 backdrop-blur-sm px-4 py-3 text-white placeholder-blue-200 focus:border-white focus:outline-none text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="0.01"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200 font-medium">
                        ETH
                      </span>
                    </div>
                  </div>

                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {["0.01", "0.05", "0.1"].map((value) => (
                      <button
                        key={value}
                        onClick={() => setAmount(value)}
                        disabled={!canDonate}
                        className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 text-sm font-semibold hover:bg-white/20 transition border border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {value} ETH
                      </button>
                    ))}
                  </div>

                  {/* Donate Button */}
                  <button
                    onClick={handleDonate}
                    disabled={!canDonate || isPending || isConfirming || parseFloat(amount) <= 0}
                    className="w-full rounded-lg bg-white text-blue-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-blue-50 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  >
                    {isPending
                      ? "⏳ Đợi xác nhận từ ví..."
                      : isConfirming
                      ? "🔄 Đang xác nhận..."
                      : !isConnected
                      ? "Kết nối ví để quyên góp"
                      : !isSepolia
                      ? "Sai mạng"
                      : campaign.completed
                      ? "Chiến dịch đã kết thúc"
                      : "💝 Quyên góp"}
                  </button>

                  {/* Transaction Status */}
                  <div className="space-y-2">
                    {isConfirmed && hash && (
                      <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white">
                        ✓ Quyên góp thành công! Cảm ơn bạn.
                      </div>
                    )}
                    {donateError && (
                      <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">
                        ⚠️ {getFriendlyError(donateError) || "Giao dịch thất bại"}
                      </div>
                    )}
                    {hash && (
                      <a
                        className="block text-center text-sm font-medium text-blue-100 hover:text-white hover:underline"
                        href={`https://sepolia.etherscan.io/tx/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem trên Sepolia Etherscan →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Network Info */}
              <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-600">SEPOLIA TESTNET</p>
                </div>
                <p className="text-xs text-slate-500">All transactions are on Ethereum Sepolia</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
