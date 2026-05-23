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
