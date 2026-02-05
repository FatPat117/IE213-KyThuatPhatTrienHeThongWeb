'use client';

import { useContractStats, useReadAllCampaigns } from '@/lib';
import { useWalletStatus } from '@/lib';

/**
 * Hiển thị thống kê contract
 * Cho phép xem dữ liệu ở chế độ read-only
 */
export function ContractStatsDisplay() {
  const { campaignCount, totalRaised, isLoading, isError, errors, refetch } =
    useContractStats();
  const { isConnected } = useWalletStatus();

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-blue-700">Đang tải thống kê contract...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Không thể tải dữ liệu</p>
        <ul className="text-xs text-red-700 space-y-1 mb-4">
          {errors.map((error, idx) => (
            <li key={idx}>• {error || 'Có lỗi xảy ra'}</li>
          ))}
        </ul>
        <button
          onClick={() => refetch()}
          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {!isConnected && (
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Bạn đang ở chế độ xem (read-only). Kết nối ví để mở khóa các thao tác giao dịch.
        </div>
      )}
      {/* Total Campaigns */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
        <p className="text-sm text-blue-600 mb-2 font-medium">📊 Tổng chiến dịch</p>
        <p className="text-3xl font-bold text-blue-900">{campaignCount}</p>
        <p className="text-xs text-blue-600 mt-2">Chiến dịch đang được ghi nhận on-chain</p>
      </div>

      {/* Total ETH Raised */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
        <p className="text-sm text-green-600 mb-2 font-medium">💰 Tổng ETH đã gây quỹ</p>
        <p className="text-3xl font-bold text-green-900">{totalRaised.toFixed(4)}</p>
        <p className="text-xs text-green-600 mt-2">Tổng hợp tất cả chiến dịch</p>
      </div>
    </div>
  );
}

/**
 * Danh sách chiến dịch (read-only)
 */
export function CampaignListDisplay() {
  const { campaigns, isLoading, isError, error, refetch } = useReadAllCampaigns();
  const { isConnected } = useWalletStatus();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-sm font-semibold text-red-800 mb-3">
          ⚠️ Không thể tải chiến dịch
        </p>
        <p className="text-xs text-red-700 mb-4">{error}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-sm text-amber-700">
          📭 Chưa có chiến dịch
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">
          Chiến dịch ({campaigns.length})
        </h3>
        <button
          onClick={() => refetch()}
          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Tải lại
        </button>
      </div>

      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{campaign.title}</h4>
              <p className="text-xs text-gray-500 mt-1">
                ID: {campaign.id} • Tạo bởi: {campaign.creator.slice(0, 6)}...
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded font-medium ${
                campaign.completed
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {campaign.completed ? '✓ Hoàn thành' : 'Đang hoạt động'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 text-xs">Mục tiêu</p>
              <p className="font-semibold text-gray-900">
                {(Number(campaign.goal) / 1e18).toFixed(4)} ETH
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">Đã gây quỹ</p>
              <p className="font-semibold text-gray-900">
                {(Number(campaign.raised) / 1e18).toFixed(4)} ETH
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full"
                style={{
                  width: `${
                    Number(campaign.goal) > 0
                      ? Math.min(
                          (Number(campaign.raised) / Number(campaign.goal)) * 100,
                          100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {Number(campaign.goal) > 0
                ? (
                    (Number(campaign.raised) / Number(campaign.goal)) *
                    100
                  ).toFixed(1)
                : 0}
              % đạt được
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Contract Reading Example Component
 * Shows how to use contract reading hooks
 */
export function ContractReadingExample() {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
      <h3 className="font-semibold text-indigo-900 mb-4">📚 Contract Reading Example</h3>
      <pre className="bg-white border border-indigo-200 rounded p-3 overflow-x-auto text-xs text-gray-700">
        {`// Import hooks
import {
  useContractStats,
  useReadAllCampaigns,
  useReadCampaign
} from '@/lib';

// Use in component
function MyComponent() {
  // Read statistics
  const stats = useContractStats();
  if (stats.isLoading) return <div>Loading...</div>;
  if (stats.isError) return <div>Error: {stats.errors}</div>;

  // Read specific campaign
  const campaign = useReadCampaign(0);

  return (
    <div>
      <p>Total: {stats.campaignCount}</p>
      <p>Raised: {stats.totalRaised} ETH</p>
    </div>
  );
}`}
      </pre>
    </div>
  );
}
