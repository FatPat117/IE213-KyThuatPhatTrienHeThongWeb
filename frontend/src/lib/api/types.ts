export interface AuthUser {
  wallet: string;
  role: 'user' | 'admin';
  displayName?: string;
  avatarUrl?: string;
}

export interface CampaignRecord {
  onChainId: number;
  title: string;
  description: string;
  images: string[];
  creator: string;
  goal: string;
  raised: string;
  deadline: string;
  status: 'active' | 'ended' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface DonationRecord {
  txHash: string;
  campaignOnChainId: number;
  donorWallet: string;
  amount: string;
  amountEth: number;
  message?: string;
  donatedAt: string;
}

export interface TransactionRecord {
  txHash: string;
  walletAddress: string;
  action: 'donate' | 'createCampaign' | 'mintNFT';
  status: 'pending' | 'success' | 'failed';
  campaignOnChainId?: number | null;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRecord {
  tokenId: number;
  campaignOnChainId: number;
  ownerWallet: string;
  metadataUri: string;
  mintedAt: string;
}
