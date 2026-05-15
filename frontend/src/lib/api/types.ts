export interface AuthUser {
  wallet: string;
  role: 'user' | 'admin';
  displayName?: string;
  avatarUrl?: string;
}

export interface CampaignMilestoneRecord {
  milestoneId?: number;
  milestoneIndex?: number;
  title?: string;
  description?: string;
  allocationBps?: number;
  financialTargetWei?: string;
  amountWei?: string;
  deadline?: string;
  status?: string;
  reportCids?: Array<{ cid?: string; submittedAt?: string }>;
  approvedAt?: string | null;
  approvedBy?: string;
  disbursedAt?: string | null;
  lastRejectionReason?: string;
  rejectionCount?: number;
  maxRetries?: number;
  pendingRejections?: number;
  rejectionVoters?: string[];
}

export interface CampaignRecord {
  onChainId: number;
  title: string;
  description: string;
  images: string[];
  thumbnailUrl?: string;
  creator: string;
  reviewerSafe?: string;
  beneficiary?: string;
  goal: string;
  raised: string;
  deadline: string;
  status: 'pending_approval' | 'active' | 'in_progress' | 'completed' | 'partial_failed' | 'failed' | 'cancelled';
  milestoneCount?: number;
  milestones?: CampaignMilestoneRecord[];
  rejectionReason?: string | null;
  rejectedAt?: string | null;
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
