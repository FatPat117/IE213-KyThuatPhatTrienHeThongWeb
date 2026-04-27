import type { Abi, Address } from 'viem';
import latestDeployment from './artifacts/sepolia-latest.json';
import fundingPlatformAbi from './artifacts/FundingPlatform.abi.json';

export const SEPOLIA_CHAIN_ID = 11155111;

// Single source of truth: reuse ABI artifact from smart-contracts.
export const CROWDFUNDING_ABI: Abi = fundingPlatformAbi as Abi;

const DEFAULT_CROWDFUNDING_CONTRACT_ADDRESS = latestDeployment.address;

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
