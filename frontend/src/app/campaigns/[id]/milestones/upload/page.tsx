"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import {
    getPublicCampaignMilestones,
    resubmitMilestone,
    useAuth,
    useReadCampaign,
    useSubmitMilestoneProof,
} from "@/lib";
import { useReadMilestonesOnChain } from "@/lib/contracts/hooks";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

function normalizeApiBaseUrl(rawUrl?: string) {
    const trimmed = rawUrl?.trim();
    if (!trimmed) return DEFAULT_API_BASE_URL;
    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    return withoutTrailingSlash.endsWith("/api")
        ? withoutTrailingSlash
        : `${withoutTrailingSlash}/api`;
}

function toSafeInteger(value: string | null | undefined, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIpfsUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("ipfs://")) {
        return `https://ipfs.io/ipfs/${trimmed.slice("ipfs://".length)}`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://ipfs.io/ipfs/${trimmed}`;
}

function toOnChainMilestoneIndex(milestoneId: number) {
    return milestoneId >= 1 ? milestoneId - 1 : milestoneId;
}

export default function MilestoneEvidenceUploadPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { token } = useAuth();
    const { address, isConnected } = useAccount();

    const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const campaignId = toSafeInteger(
        typeof idParam === "string" ? idParam : undefined,
        NaN,
    );
    const milestoneId = toSafeInteger(searchParams.get("milestone"), 0);
    const milestoneIndexOnChain = toOnChainMilestoneIndex(milestoneId);
    const sourceCid = (searchParams.get("sourceCid") || "").trim();
    const { campaign } = useReadCampaign(Number.isFinite(campaignId) ? campaignId : null);
    const { proofCidsByIndex } = useReadMilestonesOnChain(
        Number.isFinite(campaignId) ? campaignId : null,
        campaign?.milestoneCount || 0,
    );
    const { submitMilestoneProof, hash: submitHash, isPending: isSubmittingOnChain } =
        useSubmitMilestoneProof();
    const { isLoading: isConfirmingOnChain, isSuccess: isConfirmedOnChain } =
        useWaitForTransactionReceipt({ hash: submitHash });
    useRegisterWalletTxOverlay(isSubmittingOnChain || isConfirmingOnChain);

    const [title, setTitle] = useState("Báo cáo tiến độ");
    const [description, setDescription] = useState("Minh chứng tiến độ mốc giải ngân");
    const [evidenceType, setEvidenceType] = useState<
        "report" | "photo" | "video" | "document"
    >("photo");
    const [file, setFile] = useState<File | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadedCid, setUploadedCid] = useState(sourceCid);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [milestoneHistory, setMilestoneHistory] = useState<string[]>([]);
    const [milestoneStatus, setMilestoneStatus] = useState<string>("");

    const apiBaseUrl = useMemo(
        () => normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
        [],
    );
    const isCreator =
        Boolean(address) &&
        Boolean(campaign?.creator) &&
        campaign.creator.toLowerCase() === address.toLowerCase();
    const canUpload = Boolean(token && isConnected && isCreator);
    const isCampaignInProgress = Boolean(campaign?.isInProgress);

    useEffect(() => {
        const loadHistory = async () => {
            if (!Number.isFinite(campaignId)) return;
            try {
                const data = await getPublicCampaignMilestones(campaignId);
                const milestone = data.milestones.find((m) => m.milestoneId === milestoneId);
                setMilestoneStatus((milestone?.status || "").toLowerCase());
                const fromBackend = (milestone?.reportCids || []).map((x) => x.cid);
                const fromChain = proofCidsByIndex.get(milestoneIndexOnChain) || [];
                const seen = new Set<string>();
                const merged: string[] = [];
                for (const cid of [...fromBackend, ...fromChain]) {
                    const key = (cid || "").trim().toLowerCase();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    merged.push(cid);
                }
                setMilestoneHistory(merged);
            } catch {
                const fromChain = proofCidsByIndex.get(milestoneIndexOnChain) || [];
                setMilestoneHistory(fromChain);
                setMilestoneStatus("");
            }
        };
        loadHistory();
    }, [campaignId, milestoneId, milestoneIndexOnChain, proofCidsByIndex]);

    useEffect(() => {
        if (isConfirmedOnChain) {
            setResultMessage("Đã submit minh chứng on-chain thành công.");
            if (uploadedCid) {
                setMilestoneHistory((prev) =>
                    prev.some((x) => x.toLowerCase() === uploadedCid.toLowerCase())
                        ? prev
                        : [uploadedCid, ...prev],
                );
            }
        }
    }, [isConfirmedOnChain, uploadedCid]);

    const handleUploadFile = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!Number.isFinite(campaignId)) return setErrorMessage("Campaign ID không hợp lệ.");
        if (!token) return setErrorMessage("Bạn cần đăng nhập ví để upload minh chứng.");
        if (!canUpload) return setErrorMessage("Chỉ creator mới có quyền upload.");
        if (!file) return setErrorMessage("Vui lòng chọn file minh chứng.");

        setIsUploadingFile(true);
        setErrorMessage(null);
        setResultMessage(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("evidenceType", evidenceType);

            const response = await fetch(
                `${apiBaseUrl}/milestones/${campaignId}/${milestoneId}/evidence`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                },
            );
            const payload = await response.json();
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || payload?.message || "Upload thất bại");
            }

            const cid =
                payload?.data?.evidenceCid ||
                payload?.data?.cid ||
                payload?.data?.ipfsCid ||
                "";
            if (!cid) throw new Error("Upload thành công nhưng thiếu CID.");
            setUploadedCid(cid);
            setResultMessage("Upload IPFS thành công. Xác nhận để submit on-chain.");
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Không thể upload minh chứng",
            );
        } finally {
            setIsUploadingFile(false);
        }
    };

    const handleSubmitOnChain = async () => {
        if (!Number.isFinite(campaignId)) return setErrorMessage("Campaign ID không hợp lệ.");
        if (!uploadedCid) return setErrorMessage("Bạn cần upload để lấy CID trước.");
        if (!isCampaignInProgress) {
            return setErrorMessage(
                "Chiến dịch chưa ở trạng thái In Progress nên chưa thể submit minh chứng on-chain.",
            );
        }
        setErrorMessage(null);
        setResultMessage(null);
        try {
            await submitMilestoneProof(
                campaignId,
                milestoneIndexOnChain,
                uploadedCid,
            );
            setResultMessage("Đã gửi giao dịch submit minh chứng. Đang chờ xác nhận...");
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Không thể submit minh chứng on-chain",
            );
        }
    };

    const handleResubmitOffChain = async () => {
        if (!Number.isFinite(campaignId)) return setErrorMessage("Campaign ID không hợp lệ.");
        if (!token) return setErrorMessage("Bạn cần đăng nhập ví để nộp lại minh chứng.");
        if (!uploadedCid) return setErrorMessage("Chưa có CID để nộp lại.");
        setErrorMessage(null);
        try {
            await resubmitMilestone(campaignId, milestoneId, token, uploadedCid);
            setResultMessage(
                "Đã chuyển milestone sang trạng thái submitted (resubmit off-chain). Tiếp tục xác nhận on-chain ở bước 2.",
            );
            setMilestoneStatus("submitted");
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Không thể resubmit milestone",
            );
        }
    };

    const previewUrl = uploadedCid ? normalizeIpfsUrl(uploadedCid) : "";

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Minh chứng milestone
                        </p>
                        <h1 className="mt-1 text-3xl font-bold text-slate-900">
                            Upload và xác nhận minh chứng
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Mã chiến dịch #{Number.isFinite(campaignId) ? campaignId : "-"} - Mốc #
                            {milestoneId}
                        </p>
                    </div>
                    <Link
                        href={`/campaigns/${campaignId}/milestones`}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                        Quay lại timeline
                    </Link>
                </div>

                <form
                    onSubmit={handleUploadFile}
                    className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <p className="text-sm text-slate-600">
                        Luồng chuẩn: tải file lên Pinata để lấy CID, sau đó xác nhận gửi CID
                        lên blockchain.
                    </p>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">File minh chứng</span>
                        <input
                            type="file"
                            accept="image/*,application/pdf,video/*"
                            onChange={(event) => setFile(event.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-700"
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Tiêu đề</span>
                            <input
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Loại bằng chứng</span>
                            <select
                                value={evidenceType}
                                onChange={(event) =>
                                    setEvidenceType(
                                        event.target.value as
                                            | "report"
                                            | "photo"
                                            | "video"
                                            | "document",
                                    )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="photo">Ảnh</option>
                                <option value="report">Báo cáo</option>
                                <option value="video">Video</option>
                                <option value="document">Tài liệu</option>
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Mô tả</span>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                    </label>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="submit"
                            disabled={!canUpload || isUploadingFile}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {isUploadingFile ? "Đang upload..." : "1) Upload lấy CID"}
                        </button>
                        <button
                            type="button"
                            disabled={
                                !uploadedCid ||
                                !isCampaignInProgress ||
                                isSubmittingOnChain ||
                                isConfirmingOnChain
                            }
                            onClick={handleSubmitOnChain}
                            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {isSubmittingOnChain || isConfirmingOnChain
                                ? "Đang chờ xác nhận..."
                                : "2) Xác nhận submit on-chain"}
                        </button>
                        {milestoneStatus === "resubmittable" && (
                            <button
                                type="button"
                                disabled={!uploadedCid || isUploadingFile}
                                onClick={handleResubmitOffChain}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-60"
                            >
                                Resubmit off-chain
                            </button>
                        )}
                    </div>
                    {!isCampaignInProgress && (
                        <p className="text-sm text-amber-700">
                            Milestone chỉ được submit khi chiến dịch ở trạng thái In Progress.
                        </p>
                    )}

                    {uploadedCid ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <p className="font-semibold">CID mới: {uploadedCid}</p>
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-blue-700 underline"
                            >
                                Mở preview IPFS
                            </a>
                        </div>
                    ) : null}

                    {resultMessage ? (
                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {resultMessage}
                        </p>
                    ) : null}
                    {errorMessage ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {errorMessage}
                        </p>
                    ) : null}
                </form>

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Lịch sử CID đã nộp cho milestone này
                    </h2>
                    {milestoneHistory.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">Chưa có CID nào.</p>
                    ) : (
                        <ul className="mt-3 space-y-2 text-sm">
                            {milestoneHistory.map((cid) => (
                                <li
                                    key={cid}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                >
                                    <p className="break-all font-mono text-slate-700">{cid}</p>
                                    <a
                                        href={normalizeIpfsUrl(cid)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700"
                                    >
                                        Mở IPFS
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}
