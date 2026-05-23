"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog, parseEther } from "viem";
import {
    useAccount,
    useChainId,
    useReadContract,
    useWaitForTransactionReceipt,
} from "wagmi";
import {
    contractConfig,
    createTransaction,
    getCampaignIndexStatus,
    getAdminReviewerProfiles,
    saveCampaignMetadataToCache,
    updateCampaignMetadata,
    useAuth,
    useCreateCampaign,
    useReadReviewerSafes,
} from "@/lib";
import {
    getBackendErrorMessage,
    getChainErrorMessage,
} from "@/lib/errors/normalize";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import CreateCampaignForm from "@/components/campaign-create/CreateCampaignForm";
import CreateCampaignGuardCard from "@/components/campaign-create/CreateCampaignGuardCard";
import CreateCampaignHeader from "@/components/campaign-create/CreateCampaignHeader";
import CreateCampaignSuccessCard from "@/components/campaign-create/CreateCampaignSuccessCard";
import MilestoneBuilder from "@/components/campaign-create/MilestoneBuilder";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import {
    parseCampaignDescription,
    validateCampaignDescriptionParts,
} from "@/lib/utils/campaign-description-fields";
import {
    uploadImageToCloud,
    validateImageFile,
} from "@/lib/utils/uploadImage";

const SEPOLIA_CHAIN_ID = 11155111;

function shortenHash(hash: string) {
    if (!hash || hash.length < 14) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function CreateCampaignPage() {
    const router = useRouter();
    const { isConnected, address } = useAccount();
    const { token } = useAuth();
    const chainId = useChainId();
    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const isClient = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false,
    );

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        goalEth: "1.0",
        deadline: "",
        reviewerSafe: "",
        beneficiary: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [manualError, setManualError] = useState<string | null>(null);
    const [metadataSynced, setMetadataSynced] = useState(false);
    const [metadataSyncError, setMetadataSyncError] = useState<string | null>(
        null,
    );
    const [isMetadataSyncing, setIsMetadataSyncing] = useState(false);
    const [step, setStep] = useState<"basic" | "milestones">("basic");
    const [submittedTxHash, setSubmittedTxHash] = useState<
        `0x${string}` | undefined
    >(undefined);
    const [milestoneMetadata, setMilestoneMetadata] = useState<
        Array<{ name: string; description: string }>
    >([]);
    const [reviewerOptions, setReviewerOptions] = useState<
        Array<{ value: string; organization: string; region: string }>
    >([]);
    // Thumbnail upload state
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState<number | null>(null);
    const [thumbnailUploadError, setThumbnailUploadError] = useState<string | null>(null);
    const [uploadedThumbnailUrl, setUploadedThumbnailUrl] = useState<string | null>(null);
    const reviewerSafesQuery = useReadReviewerSafes();
    const normalizedReviewerSafe = formData.reviewerSafe.trim().toLowerCase();
    const reviewerSafeLooksValid = /^0x[a-f0-9]{40}$/.test(
        normalizedReviewerSafe,
    );
    const { data: isReviewerActive, isLoading: isCheckingReviewerSafe } =
        useReadContract({
            ...contractConfig,
            functionName: "isActiveReviewer",
            args: reviewerSafeLooksValid
                ? [normalizedReviewerSafe as `0x${string}`]
                : undefined,
            query: {
                enabled: reviewerSafeLooksValid,
                staleTime: 30_000,
            },
        });

    const {
        createCampaign,
        isPending,
        error: createError,
    } = useCreateCampaign();
    const {
        data: receipt,
        isLoading: isConfirming,
        isSuccess: isConfirmed,
    } = useWaitForTransactionReceipt({
        hash: submittedTxHash,
    });
    const isTxReverted = receipt?.status === "reverted";
    const isThumbnailUploading =
        thumbnailUploadProgress !== null && thumbnailUploadProgress < 100;
    useRegisterWalletTxOverlay(
        isPending || isConfirming || isMetadataSyncing || isThumbnailUploading,
        isPending
            ? "signing"
            : isConfirming
              ? "confirming"
              : "processing",
    );

    const etherscanLink = useMemo(() => {
        if (!submittedTxHash) return null;
        return `https://sepolia.etherscan.io/tx/${submittedTxHash}`;
    }, [submittedTxHash]);

    // Decode created campaign id from on-chain event logs.
    const createdCampaignId = useMemo(() => {
        if (!receipt || !isConfirmed) return null;
        try {
            const candidateLogs = receipt.logs.filter(
                (log) =>
                    log.address?.toLowerCase() ===
                    (contractConfig.address as string).toLowerCase(),
            );
            for (const log of candidateLogs) {
                try {
                    const decoded = decodeEventLog({
                        abi: contractConfig.abi,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === "CampaignCreated") {
                        const campaignId = Number(
                            (decoded.args as { campaignId?: bigint })
                                .campaignId,
                        );
                        if (!Number.isNaN(campaignId)) return campaignId;
                    }
                } catch {
                    continue;
                }
            }
        } catch (err) {
            console.error("Failed to decode CampaignCreated event", err);
        }
        return null;
    }, [receipt, isConfirmed]);

    const parsedCreateError = useMemo(() => {
        if (!createError) return null;
        return getChainErrorMessage(createError, {
            fallback: "Không thể gửi giao dịch. Vui lòng thử lại.",
        });
    }, [createError]);

    const transactionError = manualError || parsedCreateError;
    const transactionStatus:
        | "idle"
        | "pending"
        | "confirming"
        | "success"
        | "error" = transactionError
            ? "error"
            : isTxReverted
                ? "error"
                : isConfirmed
                    ? "success"
                    : isConfirming
                        ? "confirming"
                        : isPending
                            ? "pending"
                            : "idle";
    const isFormBusy = isPending || isConfirming;

    const [reviewerProfileByWallet, setReviewerProfileByWallet] = useState<
        Map<string, { organizationName: string; region: string }>
    >(new Map());

    useEffect(() => {
        let cancelled = false;
        if (!token) {
            setReviewerProfileByWallet(new Map());
            return;
        }

        getAdminReviewerProfiles(token)
            .then((profiles) => {
                if (cancelled) return;
                const next = new Map<
                    string,
                    { organizationName: string; region: string }
                >();
                for (const profile of profiles) {
                    const wallet = (profile.walletAddress || "")
                        .trim()
                        .toLowerCase();
                    if (!/^0x[a-f0-9]{40}$/.test(wallet)) continue;
                    next.set(wallet, {
                        organizationName: (profile.organizationName || "").trim(),
                        region: (profile.region || "").trim(),
                    });
                }
                setReviewerProfileByWallet(next);
            })
            .catch(() => {
                if (cancelled) return;
                setReviewerProfileByWallet(new Map());
            });

        return () => {
            cancelled = true;
        };
    }, [token]);

    useEffect(() => {
        const options = Array.from(
            new Set(
                reviewerSafesQuery.reviewerSafes
                    .map((safe) => safe.toLowerCase().trim())
                    .filter((safe) => /^0x[a-f0-9]{40}$/.test(safe)),
            ),
        ).map((safe) => {
            const profile = reviewerProfileByWallet.get(safe);
            const organization = profile?.organizationName || "Chưa rõ tổ chức";
            const region = profile?.region || "Chưa rõ vùng phụ trách";
            return {
                value: safe,
                organization,
                region,
            };
        });
        setReviewerOptions(options);
    }, [reviewerProfileByWallet, reviewerSafesQuery.reviewerSafes]);

    useEffect(() => {
        if (!formData.reviewerSafe && reviewerOptions.length > 0) {
            setFormData((prev) => ({
                ...prev,
                reviewerSafe: reviewerOptions[0].value,
            }));
        }
    }, [formData.reviewerSafe, reviewerOptions]);

    // Pre-fill beneficiary with connected wallet address when available and not yet set
    useEffect(() => {
        if (address && !formData.beneficiary) {
            setFormData((prev) => ({ ...prev, beneficiary: address.toLowerCase() }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address]);

    useEffect(() => {
        if (!submittedTxHash || !address) return;
        createTransaction(token, {
            txHash: submittedTxHash,
            walletAddress: address,
            action: "createCampaign",
            status: "pending",
            campaignOnChainId: createdCampaignId ?? undefined,
        }).catch(() => {
            showErrorToast(
                "Khong the ghi nhan transaction vao he thong theo doi.",
            );
        });
    }, [address, createdCampaignId, submittedTxHash, token]);

    useEffect(() => {
        if (!submittedTxHash || !receipt || receipt.status !== "reverted")
            return;
        const message =
            "Giao dịch đã được đưa vào block nhưng bị revert (status=0). Có thể do sai địa chỉ contract hoặc ABI không khớp phiên bản đang chạy.";
        setManualError(message);
        showErrorToast(message);
    }, [receipt, submittedTxHash]);

    useEffect(() => {
        if (!isConfirmed || !createdCampaignId) return;
        saveCampaignMetadataToCache(createdCampaignId, {
            title: formData.title,
            description: formData.description,
            thumbnailUrl: thumbnailPreview || undefined,
        });
    }, [createdCampaignId, formData.description, formData.title, isConfirmed, thumbnailPreview]);

    useEffect(() => {
        if (!isConfirmed || !createdCampaignId || metadataSynced || !token)
            return;
        let cancelled = false;

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const run = async () => {
            setIsMetadataSyncing(true);
            setMetadataSyncError(null);

            // --- Upload thumbnail to Cloudinary if a file was picked ---
            let thumbnailUrl = uploadedThumbnailUrl;
            if (thumbnailFile && !thumbnailUrl) {
                try {
                    setThumbnailUploadProgress(0);
                    const result = await uploadImageToCloud(
                        thumbnailFile,
                        (progress) => setThumbnailUploadProgress(progress),
                    );
                    thumbnailUrl = result.url;
                    setUploadedThumbnailUrl(result.url);
                    setThumbnailUploadProgress(100);
                } catch (uploadErr) {
                    const errMsg =
                        uploadErr instanceof Error
                            ? uploadErr.message
                            : 'Upload ảnh thất bại.';
                    setThumbnailUploadError(errMsg);
                    setThumbnailUploadProgress(null);
                    // Fall back to placeholder - don't abort the whole metadata sync
                }
            }

            // Wait until backend has indexed this campaign before patching metadata.
            // Do not hard-timeout here because indexing lag can fluctuate a lot.
            let retryDelayMs = 2000;
            while (!cancelled) {
                try {
                    const status =
                        await getCampaignIndexStatus(createdCampaignId);
                    if (status.indexed) break;
                } catch {
                    // Ignore transient status failures and retry.
                }
                await sleep(retryDelayMs);
                retryDelayMs = Math.min(retryDelayMs + 1000, 10000);
            }

            if (cancelled) return;

            try {
                const normalizedTitle = formData.title.trim();
                const normalizedReviewerSafe = formData.reviewerSafe
                    .trim()
                    .toLowerCase();
                const fallbackThumbnailUrl = `https://placehold.co/1200x630/png?text=${encodeURIComponent(normalizedTitle || `Campaign-${createdCampaignId}`)}`;

                await updateCampaignMetadata(createdCampaignId, token, {
                    title: normalizedTitle,
                    description: formData.description,
                    thumbnailUrl: thumbnailUrl || fallbackThumbnailUrl,
                    reviewerSafe: normalizedReviewerSafe,
                    beneficiary: formData.beneficiary.trim().toLowerCase() || undefined,
                    milestones: milestoneMetadata.map((milestone, index) => ({
                        milestoneId: index,
                        title: milestone.name.trim(),
                        description: milestone.description.trim(),
                    })),
                });
                if (!cancelled) {
                    setMetadataSynced(true);
                    setIsMetadataSyncing(false);
                }
            } catch (error) {
                const message = getBackendErrorMessage(error, {
                    fallback:
                        "Không thể đồng bộ metadata chiến dịch sau khi tạo.",
                });
                const normalizedMessage = message.toLowerCase();
                if (!cancelled) {
                    setMetadataSyncError(message);
                    setIsMetadataSyncing(false);
                    if (
                        !normalizedMessage.includes(
                            "only the campaign creator can update metadata",
                        )
                    ) {
                        showErrorToast(message);
                    }
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [
        createdCampaignId,
        formData.description,
        formData.reviewerSafe,
        formData.title,
        isConfirmed,
        metadataSynced,
        milestoneMetadata,
        thumbnailFile,
        token,
        uploadedThumbnailUrl,
    ]);

    useEffect(() => {
        if (transactionStatus !== "success") return;
        // Chỉ redirect sau khi backend đã index và sync metadata xong,
        // hoặc sau tối đa 15s hard timeout để tránh chờ mãi khi sync lỗi.
        const target =
            createdCampaignId !== null
                ? `/campaigns/${createdCampaignId}`
                : "/campaigns";

        if (metadataSynced) {
            // Metadata đã được sync → chuyển hướng ngay
            showSuccessToast(
                "Chiến dịch đã được tạo thành công và đang chờ được duyệt.",
            );
            const timer = setTimeout(() => router.push(target), 800);
            return () => clearTimeout(timer);
        }

        // Hard timeout: chờ tối đa 15s rồi redirect dù chưa sync xong
        showSuccessToast(
            "Chiến dịch đã được tạo thành công và đang chờ được duyệt.",
        );
        const timer = setTimeout(() => router.push(target), 15_000);
        return () => clearTimeout(timer);
    }, [createdCampaignId, metadataSynced, router, transactionStatus]);

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!formData.title.trim())
            errors.title = "Vui lòng nhập tên chiến dịch";
        if (formData.title.length > 100)
            errors.title = "Tên chiến dịch tối đa 100 ký tự";
        const descriptionError = validateCampaignDescriptionParts(
            parseCampaignDescription(formData.description),
        );
        if (descriptionError) {
            errors.description = descriptionError;
        }

        const goal = parseFloat(formData.goalEth);
        if (!formData.goalEth || Number.isNaN(goal))
            errors.goalEth = "Mục tiêu gây quỹ phải là số hợp lệ";
        if (goal <= 0) errors.goalEth = "Mục tiêu gây quỹ phải lớn hơn 0";
        if (goal > 1000)
            errors.goalEth = "Mục tiêu gây quỹ không vượt quá 1000 ETH";

        if (!formData.deadline) {
            errors.deadline = "Vui lòng chọn thời hạn";
        } else {
            const deadline = new Date(formData.deadline).getTime();
            const now = Date.now();
            if (deadline <= now) errors.deadline = "Thời hạn phải ở tương lai";
            if (deadline > now + 365 * 24 * 60 * 60 * 1000)
                errors.deadline = "Thời hạn không vượt quá 1 năm";
        }

        const reviewerSafe = formData.reviewerSafe.trim().toLowerCase();
        if (!reviewerSafe) {
            errors.reviewerSafe = "Vui lòng nhập địa chỉ reviewerSafe";
        } else if (!/^0x[a-f0-9]{40}$/.test(reviewerSafe)) {
            errors.reviewerSafe = "Địa chỉ reviewerSafe không hợp lệ";
        } else if (isReviewerActive === false) {
            errors.reviewerSafe =
                "ReviewerSafe chưa được duyệt on-chain. Hãy chọn ví reviewer đã được phê duyệt.";
        }

        const beneficiary = formData.beneficiary.trim().toLowerCase();
        if (!beneficiary) {
            errors.beneficiary = "Vui lòng nhập địa chỉ ví nhận tiền (beneficiary)";
        } else if (!/^0x[a-f0-9]{40}$/.test(beneficiary)) {
            errors.beneficiary = "Địa chỉ beneficiary không hợp lệ";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFieldChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (formErrors[name]) {
            setFormErrors((prev) => {
                const updated = { ...prev };
                delete updated[name];
                return updated;
            });
        }
        if (manualError) setManualError(null);
    };

    const handleThumbnailFileChange = useCallback((file: File | null) => {
        // Revoke previous object URL to prevent memory leaks
        if (thumbnailPreview && thumbnailPreview.startsWith('blob:')) {
            URL.revokeObjectURL(thumbnailPreview);
        }
        setThumbnailUploadError(null);
        setUploadedThumbnailUrl(null);
        if (!file) {
            setThumbnailFile(null);
            setThumbnailPreview(null);
            setThumbnailUploadProgress(null);
            return;
        }
        const validationError = validateImageFile(file);
        if (validationError) {
            setThumbnailUploadError(validationError);
            return;
        }
        setThumbnailFile(file);
        setThumbnailPreview(URL.createObjectURL(file));
        setThumbnailUploadProgress(null);
    }, [thumbnailPreview]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!isConnected) {
            const msg = "Vui lòng kết nối ví trước.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        if (!isSepoliaNetwork) {
            const msg = "Vui lòng chuyển sang Sepolia để tạo chiến dịch.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        if (!address) {
            const msg = "Không tìm thấy địa chỉ ví. Vui lòng kết nối lại ví.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        if (!token) {
            const msg =
                "Vui lòng ký xác thực ví trước khi tạo campaign để hệ thống lưu được tên và mô tả.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        if (!validateForm()) return;
        if (isCheckingReviewerSafe) {
            const msg =
                "Đang kiểm tra reviewerSafe trên blockchain, vui lòng thử lại sau vài giây.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        if (isReviewerActive === false) {
            const msg =
                "ReviewerSafe chưa được duyệt on-chain nên không thể tạo campaign.";
            setManualError(msg);
            showErrorToast(msg);
            return;
        }
        setMetadataSynced(false);
        setMetadataSyncError(null);
        setIsMetadataSyncing(false);
        setSubmittedTxHash(undefined);
        setStep("milestones");
    };

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <CreateCampaignHeader />
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
                        <div className="space-y-4 animate-pulse">
                            <div className="h-8 w-2/3 bg-slate-200 rounded" />
                            <div className="h-24 bg-slate-100 rounded-xl" />
                            <div className="h-24 bg-slate-100 rounded-xl" />
                            <div className="h-12 bg-slate-200 rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <CreateCampaignGuardCard
                icon="🔐"
                title="Cần kết nối ví"
                description="Vui lòng kết nối ví để tạo chiến dịch trên blockchain."
                tone="warning"
                helperTitle="💡 Lưu ý"
                helperText="Cần MetaMask hoặc ví Web3 để tạo chiến dịch và tương tác contract."
            />
        );
    }

    if (!isSepoliaNetwork) {
        return (
            <CreateCampaignGuardCard
                icon="⚠️"
                title="Sai mạng"
                description="Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch."
                tone="error"
                helperTitle="Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)"
                helperText="Vui lòng cập nhật mạng trong MetaMask để tiếp tục."
                primaryActionLabel="Hướng dẫn đổi mạng"
                onPrimaryAction={() =>
                    window.open(
                        "https://chainlist.org/?search=sepolia",
                        "_blank",
                    )
                }
            />
        );
    }

    if (step === "milestones" && transactionStatus !== "success") {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <CreateCampaignHeader onBack={() => setStep("basic")} />
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
                        <MilestoneBuilder
                            campaignInfo={{
                                title:
                                    formData.title.trim() || "Chiến dịch mới",
                                totalGoal:
                                    Number.parseFloat(
                                        formData.goalEth || "0",
                                    ) || 0,
                                campaignDeadline: formData.deadline,
                            }}
                            onBack={() => setStep("basic")}
                            onSubmit={async (nextMilestones) => {
                                try {
                                    setMilestoneMetadata(
                                        nextMilestones.map((milestone) => ({
                                            name: milestone.name,
                                            description: milestone.description,
                                        })),
                                    );
                                    setManualError(null);

                                    const campaignFundingDeadline = Math.floor(
                                        new Date(formData.deadline).getTime() /
                                        1000,
                                    );
                                    const milestoneDeadlines =
                                        nextMilestones.map((milestone) =>
                                            Math.floor(
                                                new Date(
                                                    milestone.deadline,
                                                ).getTime() / 1000,
                                            ),
                                        );

                                    if (
                                        campaignFundingDeadline <=
                                        Math.floor(Date.now() / 1000)
                                    ) {
                                        throw new Error(
                                            "Deadline chiến dịch phải ở tương lai.",
                                        );
                                    }

                                    if (
                                        milestoneDeadlines.some(
                                            (deadline) =>
                                                deadline <=
                                                campaignFundingDeadline,
                                        )
                                    ) {
                                        throw new Error(
                                            "Mọi deadline milestone phải sau deadline chiến dịch.",
                                        );
                                    }

                                    const totalGoalEth = Number.parseFloat(
                                        formData.goalEth,
                                    );
                                    if (
                                        !Number.isFinite(totalGoalEth) ||
                                        totalGoalEth <= 0
                                    ) {
                                        throw new Error(
                                            "Mục tiêu gây quỹ không hợp lệ.",
                                        );
                                    }

                                    const allocationBps = nextMilestones.map(
                                        (milestone, index) => {
                                            if (
                                                !Number.isFinite(
                                                    milestone.goal,
                                                ) ||
                                                milestone.goal <= 0
                                            ) {
                                                throw new Error(
                                                    `Milestone ${index + 1} phải có mục tiêu > 0.`,
                                                );
                                            }

                                            return Math.round(
                                                (milestone.goal /
                                                    totalGoalEth) *
                                                10_000,
                                            );
                                        },
                                    );

                                    if (
                                        allocationBps.some(
                                            (value) => value <= 0,
                                        )
                                    ) {
                                        throw new Error(
                                            "Mỗi milestone phải có tỷ lệ phân bổ > 0 bps.",
                                        );
                                    }

                                    const bpsSum = allocationBps.reduce(
                                        (sum, value) => sum + value,
                                        0,
                                    );
                                    const bpsDiff = 10_000 - bpsSum;
                                    allocationBps[allocationBps.length - 1] +=
                                        bpsDiff;

                                    const adjustedSum = allocationBps.reduce(
                                        (sum, value) => sum + value,
                                        0,
                                    );
                                    if (
                                        adjustedSum !== 10_000 ||
                                        allocationBps.some(
                                            (value) => value <= 0,
                                        )
                                    ) {
                                        throw new Error(
                                            "Không thể chuẩn hóa allocationBps về đúng 10000. Vui lòng điều chỉnh milestones.",
                                        );
                                    }

                                    const reviewerSafe = formData.reviewerSafe
                                        .trim()
                                        .toLowerCase();
                                    if (
                                        !/^0x[a-f0-9]{40}$/.test(reviewerSafe)
                                    ) {
                                        throw new Error(
                                            "Địa chỉ reviewerSafe không hợp lệ.",
                                        );
                                    }

                                    const beneficiary = formData.beneficiary
                                        .trim()
                                        .toLowerCase();
                                    if (
                                        !/^0x[a-f0-9]{40}$/.test(beneficiary)
                                    ) {
                                        throw new Error(
                                            "Địa chỉ ví nhận tiền (Beneficiary) không hợp lệ.",
                                        );
                                    }

                                    // DEBUG LOG
                                    console.log("[CreateCampaign] Gửi contract:", {
                                        beneficiary,
                                        goalWei: parseEther(formData.goalEth).toString(),
                                        allocationBps,
                                        deadlines: milestoneDeadlines,
                                        fundingDeadline: campaignFundingDeadline,
                                        reviewerSafe,
                                        now: Math.floor(Date.now() / 1000)
                                    });

                                    const txHash = await createCampaign({
                                        beneficiary: beneficiary as `0x${string}`,
                                        goalWei: parseEther(formData.goalEth),
                                        allocationBps,
                                        deadlines: milestoneDeadlines,
                                        fundingDeadline:
                                            campaignFundingDeadline,
                                        reviewerSafe:
                                            reviewerSafe as `0x${string}`,
                                    });
                                    setSubmittedTxHash(txHash);
                                } catch (err) {
                                    console.error("  [CreateCampaign] Lỗi:", err);
                                    const message = getChainErrorMessage(err, {
                                        fallback:
                                            "Không thể gửi giao dịch. Hãy xem Console (F12) để biết lý do chi tiết.",
                                    });
                                    setManualError(message);
                                    showErrorToast(message);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <CreateCampaignHeader />

                {transactionStatus === "success" ? (
                    <div className="create-campaign-form-container">
                        <CreateCampaignSuccessCard
                            txHash={submittedTxHash || ""}
                            etherscanLink={etherscanLink}
                            createdCampaignId={createdCampaignId}
                        />
                    </div>
                ) : (
                    <CreateCampaignForm
                        formData={formData}
                        reviewerOptions={reviewerOptions}
                        formErrors={formErrors}
                        isBusy={isFormBusy}
                        status={transactionStatus}
                        txHash={submittedTxHash}
                        etherscanLink={etherscanLink}
                        errorMessage={transactionError}
                        thumbnailPreview={thumbnailPreview}
                        thumbnailUploadProgress={thumbnailUploadProgress}
                        thumbnailUploadError={thumbnailUploadError}
                        onFieldChange={handleFieldChange}
                        onThumbnailFileChange={handleThumbnailFileChange}
                        onSubmit={handleSubmit}
                    />
                )}
                {metadataSyncError && (
                    <p className="mt-4 text-center text-sm text-red-400">
                        {metadataSyncError}
                    </p>
                )}
            </div>
        </div>
    );
}
