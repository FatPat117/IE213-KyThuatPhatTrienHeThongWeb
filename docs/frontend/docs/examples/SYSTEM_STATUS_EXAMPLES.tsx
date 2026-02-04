// Example 1: Using System Status in Create Campaign Page
// This shows how to integrate the status system with the campaign creation form

import { useAccount } from 'wagmi';
import { useDonateToCampaign, useRpcErrorHandler, useSystemStatus } from '@/lib';

export function CreateCampaignWithStatus() {
  const { showSuccess } = useSystemStatus();
  const { handleError } = useRpcErrorHandler();

  const handleCreateCampaign = async (formData: any) => {
    try {
      // Call contract function
      // await createCampaign(formData);

      // Show success
      showSuccess('Campaign created successfully!');
    } catch (error) {
      // Automatically detects error type and shows appropriate message
      handleError(error);
    }
  };

  return null;
}

// Example 2: Using System Status in Donation Component
export function DonateWithStatus({ campaignId }: { campaignId: number }) {
  const { donate, error } = useDonateToCampaign();
  const { showSuccess, showInsufficientGas, showRpcError } = useSystemStatus();

  const handleDonate = async (amount: string) => {
    try {
      await donate(campaignId, amount);
      showSuccess(`Donated ${amount} ETH successfully!`);
    } catch (err) {
      if (error?.message.includes('insufficient')) {
        showInsufficientGas(amount);
      } else {
        showRpcError(error?.message || 'Transaction failed');
      }
    }
  };

  return null;
}

// Example 3: Manual Status Triggers
export function ManualStatusExample() {
  const { isConnected, chain } = useAccount();
  const { showWalletDisconnected, showWrongNetwork, clearStatus } = useSystemStatus();

  // Manually check and show status
  if (!isConnected) {
    showWalletDisconnected();
  } else if (chain?.id !== 11155111) {
    showWrongNetwork(chain?.name || 'Unknown', 'Sepolia');
  } else {
    clearStatus();
  }

  return null;
}

// Example 4: Custom Status with Action
export function CustomStatusWithAction() {
  const { setStatus } = useSystemStatus();

  const handleShowNetworkError = () => {
    setStatus({
      type: 'wrong-network',
      title: 'Network Switch Required',
      message: 'Please switch to Sepolia testnet to continue.',
      action: {
        label: 'Switch Network',
        onClick: () => {
          // Implement wallet network switch
          console.log('Switching network...');
        }
      },
      dismissible: true,
    });
  };

  return (
    <button onClick={handleShowNetworkError}>
      Show Custom Status
    </button>
  );
}
