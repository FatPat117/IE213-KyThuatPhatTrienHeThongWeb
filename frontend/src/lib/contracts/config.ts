import { Address } from 'viem';

export const SEPOLIA_CHAIN_ID = 11155111;

// Minimal ABI used by frontend for Sepolia contract interaction.
export const CROWDFUNDING_ABI = [
    {
        inputs: [],
        name: 'campaignCount',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        name: 'getCampaign',
        stateMutability: 'view',
        type: 'function',
        inputs: [{ internalType: 'uint256', name: '_campaignId', type: 'uint256' }],
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'id', type: 'uint256' },
                    { internalType: 'address', name: 'creator', type: 'address' },
                    { internalType: 'address', name: 'beneficiary', type: 'address' },
                    { internalType: 'uint256', name: 'goal', type: 'uint256' },
                    { internalType: 'uint256', name: 'totalRaised', type: 'uint256' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'bool', name: 'withdrawn', type: 'bool' },
                    { internalType: 'uint8', name: 'status', type: 'uint8' },
                    { internalType: 'uint256', name: 'milestoneCount', type: 'uint256' },
                ],
                internalType: 'struct FundingPlatform.Campaign',
                name: '',
                type: 'tuple',
            },
        ],
    },
    {
        inputs: [{ internalType: 'uint256', name: '_campaignId', type: 'uint256' }],
        name: 'donate',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: '_campaignId', type: 'uint256' },
            { internalType: 'address', name: '_donor', type: 'address' },
        ],
        name: 'getDonation',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: '_beneficiary', type: 'address' },
            { internalType: 'uint256', name: '_durationDays', type: 'uint256' },
            {
              internalType: 'tuple[]',
              name: '_milestones',
              type: 'tuple[]',
              components: [
                { internalType: 'string', name: 'title', type: 'string' },
                { internalType: 'string', name: 'description', type: 'string' },
                { internalType: 'uint256', name: 'fundAmount', type: 'uint256' },
                { internalType: 'uint256', name: 'durationDays', type: 'uint256' },
              ],
            },
        ],
        name: 'createCampaign',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'uint256', name: 'campaignId', type: 'uint256' }],
        name: 'markCampaignFailed',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'uint256', name: 'campaignId', type: 'uint256' }],
        name: 'claimFundingRefund',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
          { internalType: 'uint256', name: 'campaignId', type: 'uint256' },
          { internalType: 'uint256', name: 'milestoneId', type: 'uint256' },
        ],
        name: 'claimMilestoneRefund',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
  {
    inputs: [{ internalType: 'uint256', name: '_campaignId', type: 'uint256' }],
    name: 'mintCertificate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'hasMintedCertificate',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'uint256', name: 'campaignId', type: 'uint256' },
            { indexed: true, internalType: 'address', name: 'donor', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
        ],
        name: 'Donated',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'uint256', name: 'campaignId', type: 'uint256' },
            { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
            { indexed: false, internalType: 'address', name: 'beneficiary', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'goal', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'fundingDeadline', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'milestoneCount', type: 'uint256' },
        ],
        name: 'CampaignCreated',
        type: 'event',
    },
] as const;

// Default contract address from smart-contracts/deployments/sepolia-latest.json
const DEFAULT_CROWDFUNDING_CONTRACT_ADDRESS =
    '0x543c9f923caceaf5d2799b0dc84e9d8e440df6f9';

const envContractAddress = process.env.NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS?.trim();
const isValidAddress = !!envContractAddress && /^0x[a-fA-F0-9]{40}$/.test(envContractAddress);

export const CROWDFUNDING_CONTRACT_ADDRESS: Address = (
    isValidAddress ? envContractAddress : DEFAULT_CROWDFUNDING_CONTRACT_ADDRESS
) as Address;

// Cấu hình hợp đồng
export const contractConfig = {
    address: CROWDFUNDING_CONTRACT_ADDRESS,
    abi: CROWDFUNDING_ABI,
    chainId: SEPOLIA_CHAIN_ID,
} as const;
