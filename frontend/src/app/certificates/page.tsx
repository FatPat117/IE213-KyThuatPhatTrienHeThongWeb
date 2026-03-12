'use client';

import { API_BASE_URL } from '@/lib/api/client';
import { CROWDFUNDING_CONTRACT_ADDRESS, useBackendCampaigns } from '@/lib';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';

interface CertificateRecord {
    tokenId: number;
    campaignOnChainId: number;
    ownerWallet: string;
    metadataUri: string;
    mintedAt: string;
    displayName?: string;
    campaignTitle?: string;
    donatedAmountEth?: number;
    certificateMessage?: string;
}

function normalizeMetadataUri(rawUri: string) {
    const trimmed = rawUri?.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:application/json')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('ipfs://')) {
        const ipfsPath = trimmed.slice('ipfs://'.length);
        if (!ipfsPath) return null;
        return `https://ipfs.io/ipfs/${ipfsPath}`;
    }
    return null;
}

function parseInlineMetadata(rawUri: string) {
    const normalized = normalizeMetadataUri(rawUri);
    if (!normalized || !normalized.startsWith('data:application/json')) return null;

    try {
        const base64Payload = normalized.split(',')[1] || '';
        if (!base64Payload) return null;
        const json = atob(base64Payload);
        return JSON.parse(json) as { description?: string; attributes?: Array<{ trait_type?: string; value?: string | number }> };
    } catch {
        return null;
    }
}

function hasUsableMetadata(rawUri: string) {
    const normalized = rawUri?.trim().toLowerCase();
    if (!normalized) return false;
    // Current backend fallback value is not a resolvable metadata document.
    if (normalized.includes('default-nft-metadata')) return false;
    return Boolean(normalizeMetadataUri(rawUri));
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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [printingTokenId, setPrintingTokenId] = useState<number | null>(null);
    const certificatePreviewRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
    const campaignTitleById = useMemo(() => {
        const map = new Map<number, string>();
        campaignsQuery.data.forEach((campaign) => {
            map.set(campaign.onChainId, campaign.title || `Campaign #${campaign.onChainId}`);
        });
        return map;
    }, [campaignsQuery.data]);
    const latestMintDate = useMemo(() => {
        if (certificateCount === 0) return null;
        return new Date(certificates[0].mintedAt).toLocaleDateString('vi-VN');
    }, [certificateCount, certificates]);

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
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Danh sách chứng nhận</h2>
                            </div>

                            {isLoading && <p className="text-sm text-slate-600">Đang tải dữ liệu chứng nhận...</p>}
                            {!isLoading && error && <p className="text-sm text-red-700">{error}</p>}
                            {!isLoading && !error && exportError && <p className="text-sm text-red-700">{exportError}</p>}

                            {!isLoading && !error && certificateCount === 0 && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                                    Chưa có chứng nhận. Sau khi donate thành công và mint certificate, chứng nhận sẽ xuất hiện tại đây.
                                </div>
                            )}

                            {!isLoading && !error && certificateCount > 0 && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {certificates.map((item) => {
                                        const inlineMetadata = parseInlineMetadata(item.metadataUri);
                                        const donorDisplayName =
                                            item.displayName ||
                                            String(
                                                (inlineMetadata?.attributes || []).find((attr) => attr.trait_type === 'Display Name')?.value ||
                                                    ''
                                            );
                                        const donatedAmount =
                                            typeof item.donatedAmountEth === 'number'
                                                ? item.donatedAmountEth
                                                : Number(
                                                      (inlineMetadata?.attributes || []).find(
                                                          (attr) => attr.trait_type === 'Donated Amount (ETH)'
                                                      )?.value || 0
                                                  );
                                        const campaignTitle =
                                            item.campaignTitle ||
                                            campaignTitleById.get(item.campaignOnChainId) ||
                                            `Campaign #${item.campaignOnChainId}`;
                                        const gratitudeMessage = item.certificateMessage || inlineMetadata?.description || null;

                                        return (
                                        <div key={item.tokenId} className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-5 shadow-sm transition-shadow hover:shadow-md">
                                            <div
                                                ref={(node) => setCertificatePreviewRef(item.tokenId, node)}
                                                className="relative mb-4 overflow-hidden rounded-2xl border-2 border-amber-300 bg-linear-to-br from-amber-50 via-yellow-50 to-amber-100 p-5 text-slate-800 shadow-sm"
                                            >
                                                <div className="pointer-events-none absolute -right-2 -top-6 text-6xl font-black tracking-widest text-amber-200/60">
                                                    NFT
                                                </div>
                                                <div className="pointer-events-none absolute -bottom-2 -left-2 text-4xl font-black tracking-wider text-amber-200/50">
                                                    CERT
                                                </div>
                                                <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                                                    Donation Certificate
                                                </p>
                                                <p className="relative mt-1 text-lg font-extrabold leading-tight text-amber-900">
                                                    Chứng Nhận Đóng Góp Cộng Đồng
                                                </p>
                                                <p className="relative mt-3 text-xs text-slate-700">Trân trọng cảm ơn</p>
                                                <p className="relative mt-1 text-base font-bold text-slate-900">
                                                    {donorDisplayName || item.ownerWallet.slice(0, 6) + '...' + item.ownerWallet.slice(-4)}
                                                </p>
                                                <p className="relative mt-2 text-xs text-slate-700">
                                                    đã quyên góp <span className="font-bold text-emerald-700">{formatEthAmount(donatedAmount)} ETH</span> cho chiến dịch
                                                </p>
                                                <p className="relative mt-1 text-sm font-semibold text-slate-900">{campaignTitle}</p>
                                                <div className="relative mt-4 flex items-end justify-between border-t border-amber-300/80 pt-3">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Issued by</p>
                                                        <p className="text-xs font-semibold text-slate-700">Fundraising dApp System</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-serif text-sm italic text-amber-900">Digital Signature</p>
                                                        <p className="text-[10px] text-slate-500">Token #{item.tokenId}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <p className="text-lg font-bold text-slate-900">Certificate #{item.tokenId}</p>
                                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                                    Campaign #{item.campaignOnChainId}
                                                </span>
                                            </div>
                                            <p className="text-base font-semibold text-slate-800">{campaignTitle}</p>
                                            {gratitudeMessage && (
                                                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                                                    {gratitudeMessage}
                                                </p>
                                            )}
                                            <div className="mt-3 space-y-1.5 rounded-lg bg-white/70 p-3 text-sm text-slate-700">
                                                {donorDisplayName && (
                                                    <p>
                                                        Tên hiển thị: <span className="font-semibold text-slate-900">{String(donorDisplayName)}</span>
                                                    </p>
                                                )}
                                                {Number.isFinite(donatedAmount) && donatedAmount > 0 && (
                                                    <p>
                                                        Đã donate: <span className="font-semibold text-slate-900">{formatEthAmount(donatedAmount)} ETH</span>
                                                    </p>
                                                )}
                                                <p>
                                                    Minted: <span className="font-medium text-slate-900">{new Date(item.mintedAt).toLocaleString('vi-VN')}</span>
                                                </p>
                                            </div>
                                            {!hasUsableMetadata(item.metadataUri) && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    Metadata chưa sẵn sàng hoặc đang là fallback placeholder.
                                                </p>
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
                                                <Link
                                                    href={`/campaigns/${item.campaignOnChainId}`}
                                                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                                >
                                                    Xem campaign
                                                </Link>
                                                {hasUsableMetadata(item.metadataUri) ? (
                                                    <a
                                                        href={normalizeMetadataUri(item.metadataUri) || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                                                    >
                                                        Mở metadata
                                                    </a>
                                                ) : (
                                                    <span className="rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500">
                                                        Metadata chưa có
                                                    </span>
                                                )}
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
