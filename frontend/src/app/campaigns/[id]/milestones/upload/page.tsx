"use client";

import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import {
    getPublicCampaignMilestones,
    resubmitMilestone,
    useAuth,
    useReadCampaign,
    useSubmitMilestoneProof,
} from "@/lib";
import { useReadMilestonesOnChain } from "@/lib/contracts/hooks";
import {
    getWalletErrorMessage,
    isWalletUserRejectedMessage,
} from "@/lib/errors/normalize";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";

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
    return milestoneId;
}

function toDisplayMilestoneId(milestoneId: number) {
    return milestoneId;
}

//   Tách phần dùng useSearchParams ra component riêng
function MilestoneEvidenceUploadContent() {
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

    // ✅ Declare isUploadingFile BEFORE useRegisterWalletTxOverlay
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    useRegisterWalletTxOverlay(
        isSubmittingOnChain || isConfirmingOnChain || isUploadingFile,
        isUploadingFile
            ? "processing"
            : isConfirmingOnChain
              ? "confirming"
              : "signing",
    );

    const [title, setTitle] = useState("Báo cáo tiến độ");
    const [description, setDescription] = useState("Minh chứng tiến độ mốc giải ngân");
    const [evidenceType, setEvidenceType] = useState<
        "report" | "photo" | "video" | "document"
    >("photo");
    const [files, setFiles] = useState<File[]>([]);
    const [uploadedCids, setUploadedCids] = useState<string[]>(
        sourceCid ? [sourceCid] : [],
    );
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [milestoneHistory, setMilestoneHistory] = useState<string[]>([]);
    const [milestoneStatus, setMilestoneStatus] = useState<string>("");
    const [rejectionCount, setRejectionCount] = useState<number>(0);
    const [maxRetries, setMaxRetries] = useState<number>(3);
    const [hasSubmittedOnChain, setHasSubmittedOnChain] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const apiBaseUrl = useMemo(
        () => normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
        [],
    );
    const isCreator =
        Boolean(address) &&
        Boolean(campaign?.creator) &&
        campaign?.creator.toLowerCase() === address?.toLowerCase();
    const canUpload = Boolean(token && isConnected && isCreator);
    const isCampaignInProgress = Boolean(campaign?.isInProgress);

    useEffect(() => {
        const loadHistory = async () => {
            if (!Number.isFinite(campaignId)) return;
            try {
                const data = await getPublicCampaignMilestones(campaignId);
                const milestone = data.milestones.find((m) => {
                    const normalizedId = Number(m.milestoneId);
                    return (
                        normalizedId === milestoneIndexOnChain ||
                        normalizedId === milestoneIndexOnChain + 1
                    );
                });
                setMilestoneStatus((milestone?.status || "").toLowerCase());
                setRejectionCount(typeof milestone?.rejectionCount === "number" ? milestone.rejectionCount : 0);
                setMaxRetries(typeof milestone?.maxRetries === "number" ? milestone.maxRetries : 3);
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
            const message = "Đã submit minh chứng on-chain thành công.";
            setResultMessage(message);
            showSuccessToast(message);
            setHasSubmittedOnChain(true);
            for (const uploadedCid of uploadedCids) {
                setMilestoneHistory((prev) =>
                    prev.some((x) => x.toLowerCase() === uploadedCid.toLowerCase())
                        ? prev
                        : [uploadedCid, ...prev],
                );
            }
        }
    }, [isConfirmedOnChain, uploadedCids]);

    const uploadSingleEvidence = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title.trim());
        formData.append("description", description.trim());
        formData.append("evidenceType", evidenceType);

        const response = await fetch(
            `${apiBaseUrl}/milestones/${campaignId}/${milestoneIndexOnChain}/evidence`,
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
        return cid;
    };

    const handleUploadFile = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!Number.isFinite(campaignId)) {
            showErrorToast("Campaign ID không hợp lệ.");
            return;
        }
        if (!token) {
            showErrorToast("Bạn cần đăng nhập ví để upload minh chứng.");
            return;
        }
        if (!canUpload) {
            showErrorToast("Chỉ creator mới có quyền upload.");
            return;
        }
        if (files.length === 0) {
            showErrorToast("Vui lòng chọn ít nhất 1 file.");
            return;
        }

        setIsUploadingFile(true);
        setResultMessage(null);
        try {
            const newCids: string[] = [];
            for (const selectedFile of files) {
                const cid = await uploadSingleEvidence(selectedFile);
                newCids.push(cid);
            }
            setUploadedCids((prev) => {
                const seen = new Set(prev.map((x) => x.toLowerCase()));
                const merged = [...prev];
                for (const cid of newCids) {
                    const key = cid.toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    merged.push(cid);
                }
                return merged;
            });
            setResultMessage(
                `Upload IPFS thành công ${newCids.length} file. Xác nhận để submit on-chain.`,
            );
            showSuccessToast(
                `Upload IPFS thành công ${newCids.length} file. Xác nhận để submit on-chain.`,
            );
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Không thể upload minh chứng";
            showErrorToast(message);
        } finally {
            setIsUploadingFile(false);
        }
    };

    const handleSubmitOnChain = async () => {
        if (!Number.isFinite(campaignId)) {
            showErrorToast("Campaign ID không hợp lệ.");
            return;
        }
        if (uploadedCids.length === 0) {
            showErrorToast("Bạn cần upload để lấy CID trước.");
            return;
        }
        if (!isCampaignInProgress) {
            showErrorToast(
                "Chiến dịch chưa ở trạng thái In Progress nên chưa thể submit minh chứng on-chain.",
            );
            return;
        }
        setResultMessage(null);
        try {
            for (const cid of uploadedCids) {
                await submitMilestoneProof(campaignId, milestoneIndexOnChain, cid);
            }
            setResultMessage(
                `Đã gửi ${uploadedCids.length} giao dịch đăng tải minh chứng.`,
            );
        } catch (error) {
            const normalizedMessage = getWalletErrorMessage(error, {
                fallback: "Không thể submit minh chứng on-chain",
            });
            showErrorToast(normalizedMessage, {
                emphasis: !isWalletUserRejectedMessage(normalizedMessage),
            });
        }
    };

    const handleResubmitOffChain = async () => {
        if (!Number.isFinite(campaignId)) {
            showErrorToast("Campaign ID không hợp lệ.");
            return;
        }
        if (!token) {
            showErrorToast("Bạn cần đăng nhập ví để nộp lại minh chứng.");
            return;
        }
        if (uploadedCids.length === 0) {
            showErrorToast("Chưa có CID để nộp lại.");
            return;
        }
        try {
            const newestCid = uploadedCids[uploadedCids.length - 1];
            await resubmitMilestone(campaignId, milestoneIndexOnChain, token, newestCid);
            setResultMessage(
                "Đã chuyển milestone sang trạng thái submitted (resubmit off-chain). Tiếp tục xác nhận on-chain ở bước 2.",
            );
            setMilestoneStatus("submitted");
            showSuccessToast(
                "Đã chuyển milestone sang trạng thái submitted (resubmit off-chain). Tiếp tục xác nhận on-chain ở bước 2.",
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Không thể resubmit milestone";
            showErrorToast(message);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Minh chứng thi công mốc giải ngân
                        </p>
                        <h1 className="mt-1 text-3xl font-bold text-slate-900">
                            Đăng tải và xác nhận bằng chứng thi công cho mốc #{toDisplayMilestoneId(milestoneId + 1)} của chiến dịch #{Number.isFinite(campaignId) ? campaignId : "-"}
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Mã chiến dịch #{Number.isFinite(campaignId) ? campaignId : "-"} - Mốc #
                            {toDisplayMilestoneId(milestoneId + 1)}
                        </p>
                    </div>
                    <Link
                        href={`/campaigns/${campaignId}/milestones`}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                        Quay lại xem tiến độ
                    </Link>
                </div>

                <form
                    onSubmit={handleUploadFile}
                    className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
                >
                    <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        Luồng chuẩn: tải file lên Pinata để lấy CID, sau đó xác nhận gửi CID
                        lên blockchain.
                    </p>

                    <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                            File minh chứng (chọn nhiều ảnh/tài liệu)
                        </span>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*,application/pdf,video/*"
                            multiple
                            onChange={(event) =>
                                setFiles(Array.from(event.target.files || []))
                            }
                            className="block w-full text-sm text-slate-700"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            Đã chọn: {files.length} file
                        </p>
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
                            disabled={!canUpload || isUploadingFile || hasSubmittedOnChain || files.length === 0}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {hasSubmittedOnChain ? "Đã hoàn tất" : "1) Upload file lấy CID"}
                        </button>
                        <button
                            type="button"
                            disabled={
                                uploadedCids.length === 0 ||
                                !isCampaignInProgress ||
                                isSubmittingOnChain ||
                                isConfirmingOnChain ||
                                hasSubmittedOnChain
                            }
                            onClick={handleSubmitOnChain}
                            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {hasSubmittedOnChain
                                ? "Đã submit on-chain"
                                : "2) Đăng tải tất cả CID on-chain"}
                        </button>
                    </div>
                    {!isCampaignInProgress && (
                        <p className="text-sm text-amber-700">
                            Milestone chỉ được submit khi chiến dịch ở trạng thái In Progress.
                        </p>
                    )}

                    {/* Rejection count display */}
                    {rejectionCount > 0 && (
                        <div className={`rounded-lg border px-4 py-3 text-sm ${
                            rejectionCount >= maxRetries
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}>
                            <p className="font-semibold">
                                ⚠️ Số lần bị từ chối: {rejectionCount}/{maxRetries}
                            </p>
                            {rejectionCount >= maxRetries ? (
                                <p className="mt-1 font-bold text-rose-700">
                                    🚫 Bạn đã hết số lần nộp lại. Milestone này sẽ bị đánh dấu thất bại.
                                </p>
                            ) : (
                                <p className="mt-1">
                                    Nếu bị từ chối đủ {maxRetries} lần, milestone sẽ bị đánh dấu <strong>thất bại</strong>.
                                </p>
                            )}
                        </div>
                    )}
                    {rejectionCount === 0 && milestoneStatus === "resubmittable" && (
                        <p className="text-sm text-rose-600 font-medium">
                            ⚠️ Nếu bị từ chối đủ {maxRetries} lần, milestone sẽ bị đánh dấu <strong>thất bại</strong>.
                        </p>
                    )}

                    {uploadedCids.length > 0 ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <p className="font-semibold">CID mới đã upload ({uploadedCids.length})</p>
                            <ul className="mt-2 space-y-1">
                                {uploadedCids.map((cid) => (
                                    <li key={cid} className="break-all">
                                        <a
                                            href={normalizeIpfsUrl(cid)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-700 underline"
                                        >
                                            {cid}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {resultMessage ? (
                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {resultMessage}
                        </p>
                    ) : null}
                </form>

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Lịch sử CID đã nộp cho mốc này
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

export default function MilestoneEvidenceUploadPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Đang tải...</div>}>
            <MilestoneEvidenceUploadContent />
        </Suspense>
    );
}
