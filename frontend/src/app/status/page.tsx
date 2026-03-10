'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, useBalance, useBlockNumber, useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { formatEther } from 'viem';
import BackButton from '@/components/navigation/BackButton';
import {
  useReadCampaignCount,
  useReadTotalRaised,
  CROWDFUNDING_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
} from '@/lib';

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BackButton fallbackHref="/" />
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  🔧 Chẩn đoán hệ thống
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Trạng thái hệ thống</h1>
            </div>
          </div>
          <p className="text-lg text-slate-600 ml-13">
            Kiểm tra ví, mạng, RPC và contract theo thời gian thực
          </p>
        </div>

        {/* Overall Status Card */}
        <div className={`rounded-2xl border-2 p-8 mb-8 ${
          overallStatus === 'success'
            ? 'bg-green-50 border-green-200'
            : overallStatus === 'warning'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                overallStatus === 'success'
                  ? 'bg-green-500'
                  : overallStatus === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}>
                <span className="text-2xl text-white">
                  {overallStatus === 'success' ? '✓' : overallStatus === 'warning' ? '⚠' : '✗'}
                </span>
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${
                  overallStatus === 'success'
                    ? 'text-green-900'
                    : overallStatus === 'warning'
                    ? 'text-yellow-900'
                    : 'text-red-900'
                }`}>
                  {overallStatus === 'success'
                    ? 'Hệ thống hoạt động bình thường'
                    : overallStatus === 'warning'
                    ? 'Có cảnh báo hệ thống'
                    : 'Có lỗi hệ thống'}
                </h2>
                <p className={`text-sm ${
                  overallStatus === 'success'
                    ? 'text-green-700'
                    : overallStatus === 'warning'
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}>
                  Lần kiểm tra cuối: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 rounded-lg bg-white border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition"
            >
              🔄 Tải lại
            </button>
          </div>

          {/* Status Counts */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{statusCounts.success}</p>
              <p className="text-xs text-slate-600">Đạt</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.warning}</p>
              <p className="text-xs text-slate-600">Cảnh báo</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{statusCounts.error}</p>
              <p className="text-xs text-slate-600">Lỗi</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-600">{statusCounts.loading}</p>
              <p className="text-xs text-slate-600">Đang tải</p>
            </div>
          </div>
        </div>

        {/* System Checks List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Kiểm tra hệ thống</h3>
          <div className="space-y-4">
            {checks.map((check, index) => (
              <div
                key={index}
                className={`rounded-xl border-2 p-5 ${
                  check.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : check.status === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : check.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    check.status === 'success'
                      ? 'bg-green-500'
                      : check.status === 'warning'
                      ? 'bg-yellow-500'
                      : check.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-slate-400'
                  }`}>
                    <span className="text-white text-lg font-bold">
                      {check.status === 'success'
                        ? '✓'
                        : check.status === 'warning'
                        ? '⚠'
                        : check.status === 'error'
                        ? '✗'
                        : '⋯'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`font-bold ${
                        check.status === 'success'
                          ? 'text-green-900'
                          : check.status === 'warning'
                          ? 'text-yellow-900'
                          : check.status === 'error'
                          ? 'text-red-900'
                          : 'text-slate-900'
                      }`}>
                        {check.name}
                      </h4>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        check.status === 'success'
                          ? 'bg-green-200 text-green-800'
                          : check.status === 'warning'
                          ? 'bg-yellow-200 text-yellow-800'
                          : check.status === 'error'
                          ? 'bg-red-200 text-red-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {check.status === 'success'
                          ? 'THÀNH CÔNG'
                          : check.status === 'warning'
                          ? 'CẢNH BÁO'
                          : check.status === 'error'
                          ? 'LỖI'
                          : 'ĐANG TẢI'}
                      </span>
                    </div>
                    <p className={`text-sm font-medium mb-1 ${
                      check.status === 'success'
                        ? 'text-green-800'
                        : check.status === 'warning'
                        ? 'text-yellow-800'
                        : check.status === 'error'
                        ? 'text-red-800'
                        : 'text-slate-800'
                    }`}>
                      {check.message}
                    </p>
                    {check.details && (
                      <p className={`text-xs ${
                        check.status === 'success'
                          ? 'text-green-700'
                          : check.status === 'warning'
                          ? 'text-yellow-700'
                          : check.status === 'error'
                          ? 'text-red-700'
                          : 'text-slate-700'
                      }`}>
                        {check.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/campaigns"
            className="block text-center px-6 py-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-lg"
          >
            📋 Xem chiến dịch
          </Link>
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center px-6 py-4 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
          >
            🔍 Trình khám phá Sepolia
          </a>
          <a
            href="https://faucet.sepolia.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center px-6 py-4 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
          >
            💧 Nhận ETH testnet
          </a>
        </div>

        {/* Technical Info */}
        <div className="mt-6 rounded-xl bg-slate-100 border border-slate-200 p-6">
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
