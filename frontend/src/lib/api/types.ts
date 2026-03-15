export interface AuthUser {
  wallet: string;
  role: 'user' | 'admin';
  displayName?: string;
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

export interface PaginatedResponseMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedResponseMeta;
}

export type TransactionAction =
  | 'donate'
  | 'createCampaign'
  | 'mintNFT'
  | 'withdraw'
  | 'refund'
  | 'markAsFailed'
  | 'cancelCampaign';

export interface TransactionRecord {
  txHash: string;
  walletAddress: string;
  action: TransactionAction;
  status: 'pending' | 'success' | 'failed';
  amountWei: string;
  blockNumber: number;
  chainId: number;
  gasUsed: number;
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
  donatedAmountWei: string;
  imageUrl: string;
  txHash: string;
  mintedAt: string;
}
