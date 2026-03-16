'use client';

import BackButton from '@/components/navigation/BackButton';
import {
    CROWDFUNDING_CONTRACT_ADDRESS,
    SEPOLIA_CHAIN_ID,
    useReadCampaignCount,
    useReadTotalRaised,
} from '@/lib';
import { getPublicClient } from '@wagmi/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, useBalance, useBlockNumber, useConfig } from 'wagmi';

interface SystemCheck {
    name: string;
    status: 'success' | 'warning' | 'error' | 'loading';
    message: string;
    details?: string;
}

export default function SystemStatusPage() {
    const { address, isConnected, chain } = useAccount();
    const config = useConfig();
    const { data: balance } = useBalance({ address, chainId: SEPOLIA_CHAIN_ID });
    const { data: blockNumber } = useBlockNumber({ chainId: SEPOLIA_CHAIN_ID, watch: true });

    const { count: campaignCount, isLoading: countLoading, isError: countError } = useReadCampaignCount();
    const { totalRaised, isLoading: raisedLoading, isError: raisedError } = useReadTotalRaised();

    const [checks, setChecks] = useState<SystemCheck[]>([]);
    const [rpcLatency, setRpcLatency] = useState<number | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Run system checks
    useEffect(() => {
        const runChecks = async () => {
            const newChecks: SystemCheck[] = [];

            // 1. Wallet Connection Check
            if (!isConnected || !address) {
                newChecks.push({
                    name: 'Kết nối ví',
                    status: 'error',
                    message: 'Chưa kết nối ví',
                    details: 'Vui lòng kết nối MetaMask hoặc ví Web3 để tiếp tục',
                });
            } else {
                newChecks.push({
                    name: 'Kết nối ví',
                    status: 'success',
                    message: 'Đã kết nối ví',
                    details: `Địa chỉ: ${address.slice(0, 6)}...${address.slice(-4)}`,
                });
            }

            // 2. Network Check
            if (!chain) {
                newChecks.push({
                    name: 'Phát hiện mạng',
                    status: 'error',
                    message: 'Không phát hiện mạng',
                    details: 'Không thể xác định mạng hiện tại',
                });
            } else if (chain.id !== SEPOLIA_CHAIN_ID) {
                newChecks.push({
                    name: 'Kiểm tra mạng',
                    status: 'error',
                    message: 'Sai mạng',
                    details: `Đang ở ${chain.name} (Chain ID: ${chain.id}). Vui lòng chuyển sang Sepolia (${SEPOLIA_CHAIN_ID})`,
                });
            } else {
                newChecks.push({
                    name: 'Kiểm tra mạng',
                    status: 'success',
                    message: 'Đúng mạng',
                    details: `Đang ở ${chain.name} (Chain ID: ${chain.id})`,
                });
            }

            // 3. Balance Check
            if (isConnected && address) {
                if (!balance) {
                    newChecks.push({
                        name: 'Số dư ví',
                        status: 'loading',
                        message: 'Đang tải số dư...',
                    });
                } else {
                    const balanceEth = Number(formatEther(balance.value));
                    if (balanceEth < 0.01) {
                        newChecks.push({
                            name: 'Số dư ví',
                            status: 'warning',
                            message: 'Số dư thấp',
                            details: `${balanceEth.toFixed(4)} ETH - Có thể không đủ phí gas`,
                        });
                    } else {
                        newChecks.push({
                            name: 'Số dư ví',
                            status: 'success',
                            message: 'Số dư đủ',
                            details: `${balanceEth.toFixed(4)} ETH`,
                        });
                    }
                }
            }

            // 4. RPC Connection Check
            try {
                const startTime = Date.now();
                const publicClient = getPublicClient(config);
                if (publicClient) {
                    await publicClient.getBlockNumber();
                    const latency = Date.now() - startTime;
                    setRpcLatency(latency);

                    if (latency < 500) {
                        newChecks.push({
                            name: 'Kết nối RPC',
                            status: 'success',
                            message: 'RPC phản hồi',
                            details: `Độ trễ: ${latency}ms - Tốt`,
                        });
                    } else if (latency < 2000) {
                        newChecks.push({
                            name: 'Kết nối RPC',
                            status: 'warning',
                            message: 'RPC chậm',
                            details: `Độ trễ: ${latency}ms - Nên đổi RPC`,
                        });
                    } else {
                        newChecks.push({
                            name: 'Kết nối RPC',
                            status: 'error',
                            message: 'RPC rất chậm',
                            details: `Độ trễ: ${latency}ms - Hiệu năng kém`,
                        });
                    }
                } else {
                    newChecks.push({
                        name: 'Kết nối RPC',
                        status: 'error',
                        message: 'Không có RPC client',
                        details: 'Không thể kết nối RPC endpoint',
                    });
                }
            } catch (err) {
                newChecks.push({
                    name: 'Kết nối RPC',
                    status: 'error',
                    message: 'Kết nối RPC thất bại',
                    details: err instanceof Error ? err.message : 'Lỗi RPC không xác định',
                });
            }

            // 5. Smart Contract Check
            if (CROWDFUNDING_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
                newChecks.push({
                    name: 'Smart Contract',
                    status: 'error',
                    message: 'Chưa có contract',
                    details: 'Chưa cấu hình địa chỉ contract. Hãy deploy và cập nhật trong contractConfig.ts',
                });
            } else if (countError) {
                newChecks.push({
                    name: 'Smart Contract',
                    status: 'error',
                    message: 'Đọc contract thất bại',
                    details: 'Không thể đọc contract. Có thể chưa deploy hoặc sai địa chỉ.',
                });
            } else if (countLoading) {
                newChecks.push({
                    name: 'Smart Contract',
                    status: 'loading',
                    message: 'Đang đọc contract...',
                });
            } else {
                newChecks.push({
                    name: 'Smart Contract',
                    status: 'success',
                    message: 'Contract hoạt động',
                    details: `Địa chỉ: ${CROWDFUNDING_CONTRACT_ADDRESS.slice(0, 6)}...${CROWDFUNDING_CONTRACT_ADDRESS.slice(-4)}`,
                });
            }

            // 6. Contract Data Check
            if (!countLoading && !countError && !raisedError) {
                newChecks.push({
                    name: 'Dữ liệu contract',
                    status: 'success',
                    message: 'Tải dữ liệu thành công',
                    details: `${campaignCount} chiến dịch, ${totalRaised.toFixed(4)} ETH đã gây quỹ`,
                });
            }

            // 7. Block Sync Check
            if (blockNumber) {
                newChecks.push({
                    name: 'Đồng bộ block',
                    status: 'success',
                    message: 'Đã đồng bộ',
                    details: `Block mới nhất: #${blockNumber.toString()}`,
                });
            }

            setChecks(newChecks);
        };

        runChecks();
    }, [isConnected, address, chain, balance, config, campaignCount, totalRaised, countLoading, countError, raisedLoading, raisedError, blockNumber]);

    const handleRefresh = () => {
        setLastRefresh(new Date());
        window.location.reload();
    };

    const statusCounts = {
        success: checks.filter((c) => c.status === 'success').length,
        warning: checks.filter((c) => c.status === 'warning').length,
        error: checks.filter((c) => c.status === 'error').length,
        loading: checks.filter((c) => c.status === 'loading').length,
    };

    const overallStatus = statusCounts.error > 0 ? 'error' : statusCounts.warning > 0 ? 'warning' : 'success';

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
                <div className="mb-6">
                    <BackButton fallbackHref="/" />
                </div>
                <div className="mb-8">
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-600">Trạng thái hệ thống</p>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        Health check
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Kiểm tra ví, mạng, RPC và contract theo thời gian thực.
                    </p>
                </div>

                {/* Overall Status Card - SaaS style */}
                <div
                    className={`mb-8 flex flex-col gap-6 rounded-xl border-2 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8 ${overallStatus === 'success'
                            ? 'border-emerald-200 bg-emerald-50/80'
                            : overallStatus === 'warning'
                                ? 'border-amber-200 bg-amber-50/80'
                                : 'border-red-200 bg-red-50/80'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${overallStatus === 'success'
                                    ? 'bg-emerald-500 text-white'
                                    : overallStatus === 'warning'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-red-500 text-white'
                                }`}
                        >
                            <span className="text-2xl font-bold">
                                {overallStatus === 'success' ? '✓' : overallStatus === 'warning' ? '⚠' : '✗'}
                            </span>
                        </div>
                        <div>
                            <h2
                                className={`text-xl font-bold sm:text-2xl ${overallStatus === 'success'
                                        ? 'text-emerald-900'
                                        : overallStatus === 'warning'
                                            ? 'text-amber-900'
                                            : 'text-red-900'
                                    }`}
                            >
                                {overallStatus === 'success'
                                    ? 'Hệ thống hoạt động bình thường'
                                    : overallStatus === 'warning'
                                        ? 'Có cảnh báo hệ thống'
                                        : 'Có lỗi hệ thống'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="shrink-0 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-indigo-400 hover:text-indigo-600"
                    >
                        🔄 Tải lại
                    </button>
                </div>

                {/* Status counts - compact pills */}
                <div className="mb-8 flex flex-wrap gap-3">
                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                        <span className="text-2xl font-bold text-emerald-600">{statusCounts.success}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600">OK</span>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
                        <span className="text-2xl font-bold text-amber-600">{statusCounts.warning}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600">Cảnh báo</span>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-white px-4 py-3 shadow-sm">
                        <span className="text-2xl font-bold text-red-600">{statusCounts.error}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600">Lỗi</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <span className="text-2xl font-bold text-slate-500">{statusCounts.loading}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600">Đang tải</span>
                    </div>
                </div>

                {/* System Checks - status cards */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8">
                    <h3 className="mb-6 text-lg font-bold text-slate-900">Các kiểm tra</h3>
                    <div className="space-y-4">
                        {checks.map((check, index) => (
                            <div
                                key={index}
                                className={`flex items-start gap-4 rounded-xl border-2 p-4 transition ${check.status === 'success'
                                        ? 'border-emerald-200 bg-emerald-50/50'
                                        : check.status === 'warning'
                                            ? 'border-amber-200 bg-amber-50/50'
                                            : check.status === 'error'
                                                ? 'border-red-200 bg-red-50/50'
                                                : 'border-slate-200 bg-slate-50/50'
                                    }`}
                            >
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${check.status === 'success'
                                            ? 'bg-emerald-500 text-white'
                                            : check.status === 'warning'
                                                ? 'bg-amber-500 text-white'
                                                : check.status === 'error'
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-slate-400 text-white'
                                        }`}
                                >
                                    <span className="text-lg font-bold">
                                        {check.status === 'success' ? '✓' : check.status === 'warning' ? '⚠' : check.status === 'error' ? '✗' : '⋯'}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="font-bold text-slate-900">{check.name}</h4>
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${check.status === 'success'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : check.status === 'warning'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : check.status === 'error'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-slate-200 text-slate-700'
                                                }`}
                                        >
                                            {check.status === 'success' ? 'OK' : check.status === 'warning' ? 'Cảnh báo' : check.status === 'error' ? 'Lỗi' : 'Đang tải'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-800">{check.message}</p>
                                    {check.details && <p className="mt-1 text-xs text-slate-600">{check.details}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Link
                        href="/campaigns"
                        className="rounded-xl bg-indigo-600 px-6 py-4 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md"
                    >
                        📋 Xem chiến dịch
                    </Link>
                    <a
                        href="https://sepolia.etherscan.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-center font-semibold text-slate-900 transition hover:border-indigo-300 hover:bg-slate-50"
                    >
                        🔍 Etherscan Sepolia
                    </a>
                    <a
                        href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-center font-semibold text-slate-900 transition hover:border-indigo-300 hover:bg-slate-50"
                    >
                        💧 Nhận ETH testnet
                    </a>
                </div>

                {/* Technical Info */}
                <div className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/80 p-6 ring-1 ring-slate-900/5">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">Thông tin kỹ thuật</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <p className="text-slate-600">Địa chỉ contract:</p>
                            <code className="text-slate-900 font-mono break-all">{CROWDFUNDING_CONTRACT_ADDRESS}</code>
                        </div>
                        <div>
                            <p className="text-slate-600">Mạng:</p>
                            <p className="text-slate-900 font-medium">Sepolia (Chain ID: 11155111)</p>
                        </div>
                        <div>
                            <p className="text-slate-600">Độ trễ RPC:</p>
                            <p className="text-slate-900 font-medium">{rpcLatency ? `${rpcLatency}ms` : 'Chưa đo'}</p>
                        </div>
                        <div>
                            <p className="text-slate-600">Số block:</p>
                            <p className="text-slate-900 font-medium">{blockNumber ? `#${blockNumber.toString()}` : 'Đang tải...'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
