'use client';

import { useWalletStatus, useWalletValidation } from '@/lib';

/**
 * Example component showing how to use custom wallet hooks
 * This demonstrates best practices for wallet integration
 */
export function WalletExampleComponent() {
  const walletStatus = useWalletStatus();
  const validation = useWalletValidation();

  return (
    <div className="space-y-4">
      {/* Example 1: Display wallet status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Trạng thái ví</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <span className="font-medium">Đã kết nối:</span>{' '}
            {walletStatus.isConnected ? '✓ Có' : '✗ Không'}
          </p>
          <p>
            <span className="font-medium">Địa chỉ:</span>{' '}
            {walletStatus.shortenedAddress || 'Chưa kết nối'}
          </p>
          <p>
            <span className="font-medium">Mạng:</span>{' '}
            {walletStatus.isSepoliaNetwork
              ? '✓ Sepolia'
              : '✗ Sai mạng'}
          </p>
        </div>
      </div>

      {/* Example 2: Validation with error messages */}
      <div
        className={`border rounded-lg p-4 ${
          validation.isValid
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <h3
          className={`font-semibold mb-3 ${
            validation.isValid ? 'text-green-900' : 'text-red-900'
          }`}
        >
          {validation.isValid ? '✓ Ví hợp lệ' : '✗ Có lỗi xác thực'}
        </h3>
        {validation.errors.length > 0 && (
          <ul
            className={`text-sm space-y-1 ${
              validation.isValid ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {validation.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Example 3: Protected action button */}
      <button
        disabled={!validation.isValid}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          validation.isValid
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {validation.isValid
          ? 'Sẵn sàng gửi giao dịch'
          : 'Kết nối ví để tiếp tục'}
      </button>
    </div>
  );
}

/**
 * Usage in your components:
 *
 * import { useWalletStatus, useWalletValidation } from '@/lib';
 *
 * function MyComponent() {
 *   const { isConnected, shortenedAddress, isValidNetwork } = useWalletStatus();
 *   const { isValid, errors } = useWalletValidation();
 *
 *   if (!isValid) {
 *     return <div>Please connect wallet to Sepolia network</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Connected: {shortenedAddress}</p>
 *       {/* Your component logic */

