'use client';

import type { CertificateRecord as ApiCertificateRecord, PaginatedResponseMeta } from '@/lib/api/types';
import { CROWDFUNDING_CONTRACT_ADDRESS, getCertificatesByOwner, useBackendCampaigns } from '@/lib';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';

type CertificateRecord = ApiCertificateRecord & {
    displayName?: string;
    campaignTitle?: string;
    certificateMessage?: string;
};

const EMPTY_PAGINATION_META: PaginatedResponseMeta = {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
};

const CERTIFICATES_PAGE_SIZE = 9;

function formatWeiAmount(wei: string) {
    try {
        return Number(formatEther(BigInt(wei)));
    } catch {
        return 0;
    }
}

function formatEthAmount(value: number) {
    if (!Number.isFinite(value)) return '0';
    if (value === 0) return '0';
    return value < 0.01 ? value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function createPrintableCertificateHtml(node: HTMLDivElement) {
    const clonedNode = node.cloneNode(true) as HTMLDivElement;
    const sourceElements = [node, ...Array.from(node.querySelectorAll('*'))] as HTMLElement[];
    const targetElements = [clonedNode, ...Array.from(clonedNode.querySelectorAll('*'))] as HTMLElement[];

    sourceElements.forEach((source, index) => {
        const target = targetElements[index];
        if (!target) return;
        const computedStyle = window.getComputedStyle(source);
        const inlineStyle = Array.from(computedStyle)
            .map((prop) => `${prop}: ${computedStyle.getPropertyValue(prop)};`)
            .join(' ');
        target.setAttribute('style', inlineStyle);
    });

    return clonedNode.outerHTML;
}

export default function MyCertificatesPage() {
    const { address, isConnected, chain } = useAccount();
    const campaignsQuery = useBackendCampaigns();
    const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<PaginatedResponseMeta>(EMPTY_PAGINATION_META);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [printingTokenId, setPrintingTokenId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount'>('newest');
    const [filterCampaignId, setFilterCampaignId] = useState<number | 'all'>('all');
    const certificatePreviewRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const SHOW_CERTIFICATE_DETAILS = false;

    useEffect(() => {
        setPage(1);
    }, [address]);

    const uniqueCampaignIds = useMemo(() => {
        const ids = new Set(certificates.map((c) => c.campaignOnChainId));
        return Array.from(ids).sort((a, b) => a - b);
    }, [certificates]);

    useEffect(() => {
        const loadCertificates = async () => {
            if (!isConnected || !address) {
                setCertificates([]);
                setMeta(EMPTY_PAGINATION_META);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const payload = await getCertificatesByOwner(address, page, CERTIFICATES_PAGE_SIZE);
                const rows = [...payload.data];
                rows.sort((a: CertificateRecord, b: CertificateRecord) => new Date(b.mintedAt).getTime() - new Date(a.mintedAt).getTime());
                setCertificates(rows);
                setMeta(payload.meta);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error while loading certificates');
            } finally {
                setIsLoading(false);
            }
        };

        loadCertificates();
    }, [address, isConnected, page]);

    const certificateCount = certificates.length;
    const campaignById = useMemo(() => {
        const map = new Map<number, (typeof campaignsQuery.data)[number]>();
        campaignsQuery.data.forEach((campaign) => {
            map.set(campaign.onChainId, campaign);
        });
        return map;
    }, [campaignsQuery.data]);
    const latestMintDate = useMemo(() => {
        if (certificateCount === 0) return null;
        return new Date(certificates[0].mintedAt).toLocaleDateString('vi-VN');
    }, [certificateCount, certificates]);

    const filteredCertificates = useMemo(() => {
        let result = [...certificates];
        if (filterCampaignId !== 'all') {
            result = result.filter((item) => item.campaignOnChainId === filterCampaignId);
        }
        const query = searchQuery.trim().toLowerCase();
        if (query) {
            result = result.filter((item) => {
                const campaign = campaignById.get(item.campaignOnChainId);
                const title =
                    item.campaignTitle ||
                    campaign?.title ||
                    `Campaign #${item.campaignOnChainId}`;
                const owner = item.ownerWallet.toLowerCase();
                const displayName = (item.displayName || '').toLowerCase();
                return (
                    title.toLowerCase().includes(query) ||
                    owner.includes(query) ||
                    displayName.includes(query)
                );
            });
        }

        result.sort((a: CertificateRecord, b: CertificateRecord) => {
            if (sortBy === 'amount') {
                const donatedA = formatWeiAmount(a.donatedAmountWei);
                const donatedB = formatWeiAmount(b.donatedAmountWei);
                return donatedB - donatedA;
            }
            const timeA = new Date(a.mintedAt).getTime();
            const timeB = new Date(b.mintedAt).getTime();
            return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
        });

        return result;
    }, [certificates, campaignById, searchQuery, sortBy, filterCampaignId]);

    const setCertificatePreviewRef = (tokenId: number, node: HTMLDivElement | null) => {
        certificatePreviewRefs.current[tokenId] = node;
    };

    const printCertificate = (tokenId: number) => {
        const node = certificatePreviewRefs.current[tokenId];
        if (!node) {
            setExportError('Không tìm thấy preview chứng chỉ để tải xuống.');
            return;
        }

        setExportError(null);
        setPrintingTokenId(tokenId);
        try {
            const printableCertificate = createPrintableCertificateHtml(node);
            const printFrame = document.createElement('iframe');
            printFrame.setAttribute('title', `print-certificate-${tokenId}`);
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            printFrame.style.visibility = 'hidden';
            document.body.appendChild(printFrame);

            const frameWindow = printFrame.contentWindow;
            const frameDocument = frameWindow?.document;
            if (!frameWindow || !frameDocument) {
                printFrame.remove();
                throw new Error('Không thể khởi tạo tài liệu in. Vui lòng thử lại.');
            }

            frameDocument.open();
            frameDocument.write(`
              <html>
                <head>
                  <meta charset="utf-8" />
                  <title>Certificate #${tokenId}</title>
                  <style>
                    html, body { margin: 0; padding: 0; }
                    body {
                      padding: 24px;
                      background: #f8fafc;
                      color: #0f172a;
                      font-family: Inter, Arial, sans-serif;
                    }
                    .print-wrapper {
                      width: 100%;
                      max-width: 960px;
                      margin: 0 auto;
                    }
                    @media print {
                      body {
                        background: #fff;
                        padding: 0;
                      }
                      .print-wrapper { max-width: 100%; }
                    }
                  </style>
                </head>
                <body>
                  <div class="print-wrapper">${printableCertificate}</div>
                </body>
              </html>
            `);
            frameDocument.close();

            const cleanup = () => {
                window.setTimeout(() => {
                    printFrame.remove();
                }, 500);
            };

            frameWindow.onafterprint = cleanup;
            const fonts = (frameDocument as Document & { fonts?: FontFaceSet }).fonts;
            const triggerPrint = () => {
                frameWindow.focus();
                frameWindow.print();
            };

            if (fonts?.ready) {
                fonts.ready.then(triggerPrint).catch(triggerPrint);
            } else {
                window.setTimeout(triggerPrint, 200);
            }
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Xuất chứng chỉ thất bại. Vui lòng thử lại.');
        } finally {
            setPrintingTokenId(null);
        }
    };

    const handleShare = async (tokenId: number) => {
        try {
            const url = `${window.location.origin}/certificates#token-${tokenId}`;
            if (navigator.share) {
                await navigator.share({
                    title: `Certificate #${tokenId}`,
                    text: 'Chứng chỉ đóng góp của tôi trên hệ thống gây quỹ.',
                    url,
                });
                return;
            }
            await navigator.clipboard?.writeText(url);
            alert('Đã copy link chứng chỉ vào clipboard.');
        } catch {
            alert('Không thể chia sẻ hoặc copy link. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <Header />

            const frameWindow = printFrame.contentWindow;
            const frameDocument = frameWindow?.document;
            if (!frameWindow || !frameDocument) {
                printFrame.remove();
                throw new Error('Không thể khởi tạo tài liệu in. Vui lòng thử lại.');
            }

            frameDocument.open();
            frameDocument.write(`
              <html>
                <head>
                  <meta charset="utf-8" />
                  <title>Certificate #${tokenId}</title>
                  <style>
                    html, body { margin: 0; padding: 0; }
                    body {
                      padding: 24px;
                      background: #f8fafc;
                      color: #0f172a;
                      font-family: Inter, Arial, sans-serif;
                    }
                    .print-wrapper {
                      width: 100%;
                      max-width: 960px;
                      margin: 0 auto;
                    }
                    @media print {
                      body {
                        background: #fff;
                        padding: 0;
                      }
                      .print-wrapper { max-width: 100%; }
                    }
                  </style>
                </head>
                <body>
                  <div class="print-wrapper">${printableCertificate}</div>
                </body>
              </html>
            `);
            frameDocument.close();

            const cleanup = () => {
                window.setTimeout(() => {
                    printFrame.remove();
                }, 500);
            };

            frameWindow.onafterprint = cleanup;
            const fonts = (frameDocument as Document & { fonts?: FontFaceSet }).fonts;
            const triggerPrint = () => {
                frameWindow.focus();
                frameWindow.print();
            };

            if (fonts?.ready) {
                fonts.ready.then(triggerPrint).catch(triggerPrint);
            } else {
                window.setTimeout(triggerPrint, 200);
            }
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Xuất chứng chỉ thất bại. Vui lòng thử lại.');
        } finally {
            setPrintingTokenId(null);
        }
    };

    const handleShare = async (tokenId: number) => {
        try {
            const url = `${window.location.origin}/certificates#token-${tokenId}`;
            if (navigator.share) {
                await navigator.share({
                    title: `Certificate #${tokenId}`,
                    text: 'Chứng chỉ đóng góp của tôi trên hệ thống gây quỹ.',
                    url,
                });
                return;
            }
            await navigator.clipboard?.writeText(url);
            alert('Đã copy link chứng chỉ vào clipboard.');
        } catch {
            alert('Không thể chia sẻ hoặc copy link. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
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
                            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Danh sách chứng nhận</h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Bạn có thể tìm theo tên campaign, địa chỉ ví hoặc tên hiển thị.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                                        disabled={page <= 1 || isLoading}
                                        className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span>
                                        Page {meta.currentPage} of {Math.max(meta.totalPages, 1)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => current + 1)}
                                        disabled={isLoading || page >= meta.totalPages}
                                        className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                    <select
                                        aria-label="Lọc theo chiến dịch"
                                        value={filterCampaignId === 'all' ? 'all' : filterCampaignId}
                                        onChange={(e) =>
                                            setFilterCampaignId(
                                                e.target.value === 'all' ? 'all' : Number(e.target.value)
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none sm:w-44"
                                    >
                                        <option value="all">Tất cả chiến dịch</option>
                                        {uniqueCampaignIds.map((id) => {
                                            const c = campaignById.get(id);
                                            const title = c?.title || `Campaign #${id}`;
                                            return (
                                                <option key={id} value={id}>
                                                    {title}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Tìm theo campaign, ví, tên..."
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none sm:w-52"
                                    />
                                    <label className="sr-only" htmlFor="certificate-sort">
                                        Sắp xếp chứng nhận
                                    </label>
                                    <select
                                        id="certificate-sort"
                                        value={sortBy}
                                        onChange={(e) =>
                                            setSortBy(e.target.value as 'newest' | 'oldest' | 'amount')
                                        }
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none sm:w-40"
                                    >
                                        <option value="newest">Mới nhất</option>
                                        <option value="oldest">Cũ nhất</option>
                                        <option value="amount">Số tiền donate</option>
                                    </select>
                                </div>
                            </div>

                            {isLoading && <p className="text-sm text-slate-600">Đang tải dữ liệu chứng nhận...</p>}
                            {!isLoading && error && <p className="text-sm text-red-700">{error}</p>}
                            {!isLoading && !error && exportError && <p className="text-sm text-red-700">{exportError}</p>}

                            {!isLoading && !error && certificateCount === 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-sm text-slate-600 text-center">
                                    Chưa có chứng nhận. Sau khi donate thành công và mint certificate, chứng nhận sẽ xuất hiện tại đây.
                                </div>
                            )}

                            {!isLoading && !error && certificateCount > 0 && filteredCertificates.length === 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-sm text-slate-600 text-center">
                                    Không tìm thấy chứng nhận nào theo bộ lọc hiện tại. Hãy thử xóa hoặc thay đổi từ khóa tìm kiếm.
                                </div>
                            )}

                            {!isLoading && !error && filteredCertificates.length > 0 && (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredCertificates.map((item) => {
                                        const donorDisplayName = item.displayName || '';
                                        const donatedAmount = formatWeiAmount(item.donatedAmountWei);
                                        const campaign = campaignById.get(item.campaignOnChainId);
                                        const campaignTitle =
                                            item.campaignTitle ||
                                            campaign?.title ||
                                            `Campaign #${item.campaignOnChainId}`;
                                        const campaignDescription = campaign?.description || null;
                                        const gratitudeMessage = item.certificateMessage || campaignDescription || null;
                                        const amountTagClass =
                                            donatedAmount >= 0.1
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                : donatedAmount >= 0.01
                                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200';

                                        return (
                                        <div key={item.tokenId} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${amountTagClass}`}>
                                                    {formatEthAmount(donatedAmount)} ETH
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    #{item.tokenId} · Campaign #{item.campaignOnChainId}
                                                </span>
                                            </div>
                                            <div
                                                ref={(node) => setCertificatePreviewRef(item.tokenId, node)}
                                                className="relative mb-4 overflow-hidden rounded-2xl border-2 border-amber-500/80 bg-amber-50/80 p-4 text-slate-800 shadow-sm"
                                            >
                                                {item.imageUrl && (
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={`Certificate ${item.tokenId}`}
                                                        className="mb-3 h-40 w-full rounded-lg border border-amber-200 object-cover"
                                                        loading="lazy"
                                                    />
                                                )}
                                                <div className="pointer-events-none absolute inset-2 rounded-xl border border-amber-200/80" />
                                                <div className="relative flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-700">
                                                            Certificate of Appreciation
                                                        </p>
                                                        <p className="mt-1.5 text-base font-bold leading-tight text-amber-900">
                                                            Chứng Nhận Đóng Góp Cộng Đồng
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border border-amber-300 bg-amber-100/60 px-2.5 py-1.5 text-right">
                                                        <p className="text-[9px] font-medium text-slate-600">Token</p>
                                                        <p className="text-xs font-semibold text-slate-900">#{item.tokenId}</p>
                                                        <p className="mt-0.5 text-[9px] text-slate-600">
                                                            {new Date(item.mintedAt).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="relative mt-3 text-[11px] text-slate-700">
                                                    Ban tổ chức xin trân trọng chứng nhận rằng
                                                </p>
                                                <p className="relative mt-1.5 text-sm font-bold text-slate-900">
                                                    {donorDisplayName || item.ownerWallet.slice(0, 6) + '...' + item.ownerWallet.slice(-4)}
                                                </p>
                                                <p className="relative mt-1.5 text-[11px] text-slate-700">
                                                    đã đóng góp{' '}
                                                    <span className="font-bold text-emerald-700">
                                                        {formatEthAmount(donatedAmount)} ETH
                                                    </span>{' '}
                                                    cho chiến dịch
                                                </p>
                                                <p className="relative mt-1 text-xs font-semibold text-slate-900 line-clamp-2">
                                                    {campaignTitle}
                                                </p>
                                                <div className="relative mt-3 flex items-end justify-between border-t border-amber-300/80 pt-2">
                                                    <div>
                                                        <p className="text-[9px] uppercase tracking-widest text-slate-500">
                                                            Issued by
                                                        </p>
                                                        <p className="text-[11px] font-semibold text-slate-700">
                                                            Fundraising dApp
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-serif text-xs italic text-amber-900">
                                                            Digital Signature
                                                        </p>
                                                        <p className="text-[9px] text-slate-500">
                                                            Campaign #{item.campaignOnChainId}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {SHOW_CERTIFICATE_DETAILS && (
                                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-xs font-medium text-slate-500">
                                                            Certificate
                                                        </p>
                                                        <p className="text-base font-bold text-slate-900">
                                                            #{item.tokenId}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                                            Campaign #{item.campaignOnChainId}
                                                        </span>
                                                        {Number.isFinite(donatedAmount) && donatedAmount > 0 && (
                                                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                                {formatEthAmount(donatedAmount)} ETH
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {gratitudeMessage && (
                                                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
                                                    {gratitudeMessage}
                                                </p>
                                            )}
                                            {SHOW_CERTIFICATE_DETAILS && (
                                                <div className="mt-3 space-y-1.5 rounded-2xl border border-slate-100 bg-white/80 p-3 text-sm text-slate-700">
                                                    {donorDisplayName && (
                                                        <p>
                                                            Tên hiển thị:{' '}
                                                            <span className="font-semibold text-slate-900">
                                                                {String(donorDisplayName)}
                                                            </span>
                                                        </p>
                                                    )}
                                                    {Number.isFinite(donatedAmount) && donatedAmount > 0 && (
                                                        <p>
                                                            Đã donate:{' '}
                                                            <span className="font-semibold text-slate-900">
                                                                {formatEthAmount(donatedAmount)} ETH
                                                            </span>
                                                        </p>
                                                    )}
                                                    <p>
                                                        Minted:{' '}
                                                        <span className="font-medium text-slate-900">
                                                            {new Date(item.mintedAt).toLocaleString('vi-VN')}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => printCertificate(item.tokenId)}
                                                    disabled={printingTokenId === item.tokenId}
                                                    className="rounded-lg border border-amber-300 bg-amber-100 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {printingTokenId === item.tokenId ? 'Đang mở hộp thoại in...' : 'In / Lưu PDF'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleShare(item.tokenId)}
                                                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                                                >
                                                        Share
                                                </button>
                                                <Link
                                                    href={`/campaigns/${item.campaignOnChainId}`}
                                                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                                >
                                                    Xem campaign
                                                </Link>
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                                                >
                                                    View mint transaction
                                                </a>
                                                <a
                                                    href={`https://sepolia.etherscan.io/token/${CROWDFUNDING_CONTRACT_ADDRESS}?a=${item.tokenId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                                                >
                                                    Xem trên Etherscan
                                                </a>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
