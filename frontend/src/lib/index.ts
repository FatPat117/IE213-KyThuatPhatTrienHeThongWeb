// Contracts
export {
    CROWDFUNDING_ABI,
    CROWDFUNDING_CONTRACT_ADDRESS,
    SEPOLIA_CHAIN_ID,
    contractConfig
} from './contracts/config';
export {
    useContractStats, useCreateCampaign, useDonateToCampaign, useMarkAsFailed, useMintCertificate, useReadAllCampaigns, useReadCampaign, useReadCampaignCount, useReadFilteredCampaigns, useReadTotalRaised, useRefundDonation, useWithdrawFunds
} from './contracts/hooks';
export { config } from './contracts/wagmi';

// Context
export { StatusContext, StatusProvider, type StatusContextType, type StatusMessage, type StatusType } from './context/status';
export { AuthProvider, useAuth } from './context/auth';

// Providers
export { NetworkStatusMonitor } from './providers/network-monitor';
export { WagmiProviderWrapper } from './providers/wagmi-provider';

// Hooks
export { useRpcErrorHandler } from './hooks/use-rpc-error';
export { useHasStatus, useStatusType, useSystemStatus } from './hooks/use-system-status';
export { useBackendCampaign, useBackendCampaigns, useBackendDonations, useBackendTransactions } from './hooks/use-backend-data';
export { useIsSepoliaNetwork, useShortenAddress, useWalletStatus, useWalletValidation } from './hooks/use-wallet';
export {
    getCampaignMetadataFromCache,
    isPlaceholderCampaignDescription,
    isPlaceholderCampaignTitle,
    saveCampaignMetadataToCache
} from './utils/campaign-metadata-cache';

// API
export { getCampaignById, getCampaigns, updateCampaignMetadata } from './api/campaigns';
export { getCertificatesByOwner } from './api/certificates';
export { getDonationsByCampaign, getDonationsByWallet } from './api/donations';
export { createTransaction, getTransactionsByWallet } from './api/transactions';
export { requestNonce, refreshAuthToken, verifyWalletSignature } from './api/auth';
export { getUserProfile, toAuthUserProfile, updateUserProfile } from './api/users';

