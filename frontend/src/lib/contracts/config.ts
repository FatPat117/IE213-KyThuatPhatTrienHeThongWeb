import { Address } from 'viem';

// Hợp đồng thông minh ABI - Phiên bản đơn giản hóa, hãy thay bằng ABI thực tế
export const CROWDFUNDING_ABI = [
  {
    inputs: [],
    name: 'campaignCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalRaised',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_campaignId', type: 'uint256' }],
    name: 'getCampaign',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'string', name: 'title', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'uint256', name: 'goal', type: 'uint256' },
          { internalType: 'uint256', name: 'raised', type: 'uint256' },
          { internalType: 'bool', name: 'completed', type: 'bool' },
        ],
        internalType: 'struct FundRaising.Campaign',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllCampaigns',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'string', name: 'title', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'uint256', name: 'goal', type: 'uint256' },
          { internalType: 'uint256', name: 'raised', type: 'uint256' },
          { internalType: 'bool', name: 'completed', type: 'bool' },
        ],
        internalType: 'struct FundRaising.Campaign[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
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
      { internalType: 'string', name: '_title', type: 'string' },
      { internalType: 'string', name: '_description', type: 'string' },
      { internalType: 'uint256', name: '_goal', type: 'uint256' },
      { internalType: 'uint256', name: '_deadline', type: 'uint256' },
    ],
    name: 'createCampaign',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'campaignId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'donor', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'DonationReceived',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'campaignId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'string', name: 'title', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'goal', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'CampaignCreated',
    type: 'event',
  },
] as const;

// Địa chỉ hợp đồng - Thay bằng địa chỉ hợp đồng được triển khai
// Định dạng: 0x{40 ký tự hex}
export const CROWDFUNDING_CONTRACT_ADDRESS: Address =
  '0x0000000000000000000000000000000000000000'; // TODO: Thay bằng địa chỉ hợp đồng thực

// Cấu hình hợp đồng
export const contractConfig = {
  address: CROWDFUNDING_CONTRACT_ADDRESS,
  abi: CROWDFUNDING_ABI,
} as const;
