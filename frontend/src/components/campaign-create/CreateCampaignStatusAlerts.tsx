'use client';

interface CreateCampaignStatusAlertsProps {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  etherscanLink: string | null;
  errorMessage: string | null;
}

/**
 * Transaction progress and error alerts for create campaign flow.
 */
export default function CreateCampaignStatusAlerts({
  status,
  txHash,
  etherscanLink,
  errorMessage,
}: CreateCampaignStatusAlertsProps) {
  return (
    <>
      {status === 'pending' && (
        <div className="form-status-alert form-status-alert-pending">
          <div className="flex items-center gap-3">
            <div className="form-status-spinner shrink-0" />
            <div>
              <p className="form-status-title">⏳ Đang chờ xác nhận từ ví...</p>
              <p className="form-status-text">
                Vui lòng mở ví và xác nhận giao dịch.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'confirming' && (
        <div className="form-status-alert form-status-alert-pending">
          <div className="flex items-start gap-3">
            <div className="form-status-spinner mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="form-status-title">
                🔄 Đang xác nhận trên blockchain...
              </p>
              <p className="form-status-text mb-3">
                Quá trình này có thể mất 10-30 giây. Vui lòng chờ Sepolia xác
                nhận.
              </p>
              {txHash && (
                <div className="form-status-tx-box">
                  <p className="field-hint mb-1">Mã giao dịch:</p>
                  <code className="block break-all rounded-md bg-black/20 px-2 py-1 font-mono text-xs text-slate-200">
                    {txHash}
                  </code>
                  <a
                    href={etherscanLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#a5b4fc] hover:text-cyan-300"
                  >
                    Xem trên Etherscan →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="form-status-alert form-status-alert-error">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/90">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="form-status-title text-red-200">
                Giao dịch thất bại
              </p>
              {errorMessage && (
                <p className="form-status-text">{errorMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
