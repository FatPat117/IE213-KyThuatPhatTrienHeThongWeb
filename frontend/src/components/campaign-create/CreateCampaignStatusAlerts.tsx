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
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full shrink-0" />
            <div>
              <p className="text-blue-900 font-semibold mb-1">⏳ Đang chờ xác nhận từ ví...</p>
              <p className="text-blue-700 text-sm">Vui lòng mở ví và xác nhận giao dịch.</p>
            </div>
          </div>
        </div>
      )}

      {status === 'confirming' && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-900 font-semibold mb-1">🔄 Đang xác nhận trên blockchain...</p>
              <p className="text-blue-700 text-sm mb-3">
                Quá trình này có thể mất 10-30 giây. Vui lòng chờ Sepolia xác nhận.
              </p>
              {txHash && (
                <div className="rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-600 mb-1">Mã giao dịch:</p>
                  <code className="block rounded-md bg-slate-50 px-2 py-1 text-xs font-mono text-slate-900 break-all">
                    {txHash}
                  </code>
                  <a
                    href={etherscanLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
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
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-red-900 font-semibold mb-1">❌ Giao dịch thất bại</p>
              {errorMessage && <p className="text-red-700 text-sm">{errorMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
