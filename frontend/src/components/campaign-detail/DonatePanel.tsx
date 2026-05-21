"use client";

import { formatEther } from "viem";

interface DonatePanelProps {
  amount: string;
  canDonate: boolean;
  isConnected: boolean;
  isSepolia: boolean;
  campaignStatusLabel?:
    | "pending_approval"
    | "active"
    | "in_progress"
    | "completed"
    | "partial_failed"
    | "failed"
    | "cancelled";
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash?: string;
  donateError?: string | null;
  goal: string;
  raised: string;
  onAmountChange: (value: string) => void;
  onDonate: () => void;
}

/**
 * Donation action panel used in campaign detail page.
 */
export default function DonatePanel({
  amount,
  canDonate,
  isConnected,
  isSepolia,
  campaignStatusLabel,
  isPending,
  isConfirming,
  isConfirmed,
  txHash,
  donateError,
  goal,
  raised,
  onAmountChange,
  onDonate,
}: DonatePanelProps) {
  const goalWei = BigInt(goal || "0");
  const remainingGoalWei = goalWei > 0n ? goalWei - BigInt(raised || "0") : 0n;
  const remainingGoalEth = Number(formatEther(remainingGoalWei));
  const amountEth = parseFloat(amount) || 0;

  const isExceedGoal = goalWei > 0n && remainingGoalWei >= 0n && amountEth > remainingGoalEth;
  const isCompleted = campaignStatusLabel === "completed";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 shadow-xl text-white">
      <h3 className="text-2xl font-bold mb-2">Ủng hộ chiến dịch</h3>
      <p className="text-blue-100 mb-6 text-sm">
        Giao dịch sẽ được ghi nhận trên blockchain để minh bạch hoàn toàn
      </p>

      {/* Success banner for completed status */}
      {isCompleted && (
        <div className="mb-4 rounded-lg bg-green-400/20 border border-green-400/40 px-4 py-3 text-sm text-green-100 animate-pulse">
          🎉 Chiến dịch đã hoàn thành thành công! Cảm ơn bạn đã đồng hành.
        </div>
      )}

      {!isConnected && !isCompleted && (
        <div className="mb-4 rounded-lg bg-white/10 border border-white/30 px-4 py-3 text-sm text-blue-100">
          🔐 Vui lòng kết nối ví để quyên góp.
        </div>
      )}

      {isConnected && !isSepolia && !isCompleted && (
        <div className="mb-4 rounded-lg bg-yellow-500/20 border border-yellow-200/40 px-4 py-3 text-sm text-yellow-100">
          ⚠️ Sai mạng. Vui lòng chuyển sang Sepolia để quyên góp.
        </div>
      )}

      <div className="space-y-4">
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
              onChange={(event) => onAmountChange(event.target.value)}
              disabled={!canDonate || isCompleted}
              className="w-full rounded-lg border-2 border-blue-400 bg-white/10 px-4 py-3 text-white placeholder-blue-200 focus:border-white focus:outline-none text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="0.01"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200 font-medium">
              ETH
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["0.01", "0.05", "0.1"].map((value) => (
            <button
              key={value}
              onClick={() => onAmountChange(value)}
              disabled={!canDonate || isCompleted}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20 transition border border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {value} ETH
            </button>
          ))}
        </div>

        <button
          onClick={onDonate}
          disabled={
            !canDonate ||
            isPending ||
            isConfirming ||
            parseFloat(amount) <= 0 ||
            isExceedGoal ||
            isCompleted
          }
          className="w-full rounded-lg bg-white text-blue-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-blue-50 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "⏳ Đợi xác nhận từ ví..."
            : isConfirming
            ? "🔄 Đang xác nhận..."
            : !isConnected
            ? "Kết nối ví để quyên góp"
            : !isSepolia
            ? "Sai mạng"
            : campaignStatusLabel && campaignStatusLabel !== "active"
            ? campaignStatusLabel === "pending_approval"
              ? "Chiến dịch đang chờ duyệt"
              : campaignStatusLabel === "in_progress"
              ? "Chiến dịch đang triển khai các mốc"
              : campaignStatusLabel === "completed"
              ? "Chiến dịch đã thành công"
              : campaignStatusLabel === "partial_failed"
              ? "Chiến dịch thất bại một phần"
              : campaignStatusLabel === "failed"
              ? "Chiến dịch đã thất bại"
              : campaignStatusLabel === "cancelled"
              ? "Chiến dịch đã bị hủy/từ chối"
              : "Chiến dịch đã kết thúc"
            : isExceedGoal
            ? `Vượt mục tiêu ${remainingGoalEth.toFixed(4)} ETH`
            : "💝 Quyên góp"}
        </button>

        <div className="space-y-2">
          {isConfirmed && txHash && (
            <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white text-center">
              ✓ Quyên góp thành công! Cảm ơn bạn.
            </div>
          )}
          {donateError && (
            <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">
              ⚠️ {donateError}
            </div>
          )}
          {txHash && (
            <a
              className="block text-center text-sm font-medium text-blue-100 hover:text-white hover:underline"
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              Xem trên Sepolia Etherscan →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
