'use client';

import Header from '@/components/layout/Header';
import { API_BASE_URL } from '@/lib/api/client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

interface CertificateRecord {
    tokenId: number;
    campaignOnChainId: number;
    ownerWallet: string;
    metadataUri: string;
    mintedAt: string;
}

export default function MyCertificatesPage() {
    const { address, isConnected, chain } = useAccount();
    const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadCertificates = async () => {
            if (!isConnected || !address) {
                setCertificates([]);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/certificates/owner/${address}`);
                if (!response.ok) {
                    throw new Error('Không thể tải danh sách chứng nhận');
                }

                const payload = await response.json();
                const rows = Array.isArray(payload?.data) ? payload.data : [];
                setCertificates(rows);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Lỗi không xác định');
            } finally {
                setIsLoading(false);
            }
        };

        loadCertificates();
    }, [address, isConnected]);

    const certificateCount = certificates.length;
    const latestMintDate = useMemo(() => {
        if (certificateCount === 0) return null;
        return new Date(certificates[0].mintedAt).toLocaleDateString('vi-VN');
    }, [certificateCount, certificates]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <Header />

            <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div>
                        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                            NFT Certificates
                        </span>
                        <h1 className="mt-3 text-3xl font-bold text-slate-900">Chứng nhận của tôi</h1>
                        <p className="mt-2 text-slate-600">
                            Dữ liệu được lấy từ backend indexer đồng bộ từ sự kiện `CertificateMinted` trên blockchain.
                        </p>
                    </div>
                    <Link
                        href="/donations"
                        className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                    >
                        Xem lịch sử quyên góp
                    </Link>
                </div>

                {!isConnected && (
                    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-900">
                        Vui lòng kết nối ví để xem danh sách chứng nhận NFT của bạn.
                    </div>
                )}

                {isConnected && chain?.id !== 11155111 && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
                        Bạn đang ở sai mạng. Vui lòng chuyển sang Sepolia để đảm bảo dữ liệu và giao dịch chính xác.
                    </div>
                )}

                {isConnected && (
                    <>
                        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-5">
                                <p className="text-sm text-slate-600">Ví kết nối</p>
                                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                                    {address?.slice(0, 6)}...{address?.slice(-4)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-5">
                                <p className="text-sm text-slate-600">Số chứng nhận</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{certificateCount}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-5">
                                <p className="text-sm text-slate-600">Lần cấp gần nhất</p>
                                <p className="mt-1 font-semibold text-slate-900">{latestMintDate || 'Chưa có'}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Danh sách chứng nhận</h2>
                            </div>

                            {isLoading && <p className="text-sm text-slate-600">Đang tải dữ liệu chứng nhận...</p>}
                            {!isLoading && error && <p className="text-sm text-red-700">{error}</p>}

                            {!isLoading && !error && certificateCount === 0 && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                                    Chưa có chứng nhận. Sau khi donate thành công và mint certificate, chứng nhận sẽ xuất hiện tại đây.
                                </div>
                            )}

                            {!isLoading && !error && certificateCount > 0 && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {certificates.map((item) => (
                                        <div key={item.tokenId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="font-semibold text-slate-900">Certificate #{item.tokenId}</p>
                                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                                    Campaign #{item.campaignOnChainId}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600">Minted: {new Date(item.mintedAt).toLocaleString('vi-VN')}</p>
                                            <p className="mt-1 break-all text-xs text-slate-600">Metadata: {item.metadataUri}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
