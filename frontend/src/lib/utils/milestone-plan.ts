export type MilestoneTemplate = {
    title: string;
    allocationPercent: number;
    cumulativePercent: number;
    description: string;
};

export type MilestoneStatus =
    | "completed"
    | "in_progress"
    | "upcoming"
    | "delayed"
    | "failed"
    | "cancelled";

export type CampaignStatusForTimeline =
    | "pending_approval"
    | "active"
    | "in_progress"
    | "completed"
    | "partial_failed"
    | "failed"
    | "cancelled";

export type TimelineMilestone = {
    id: string;
    title: string;
    allocationPercent: number;
    cumulativePercent: number;
    description: string;
    expectedDate: Date;
    targetAmountWei: bigint;
    status: MilestoneStatus;
};

type BuildMilestonesInput = {
    campaignId: number;
    campaignDeadline: number;
    campaignCreatedAt?: string;
    progressPercent: number;
    goalWei?: bigint;
    /** Tổng đã huy động — dùng tính mục tiêu tài chính từng mốc: totalRaised * allocationBps / 10000 */
    totalRaisedWei?: bigint;
    milestoneCount?: number;
    campaignStatusLabel?: CampaignStatusForTimeline;
    currentMilestoneId?: number;
};

export const DEFAULT_MILESTONE_TEMPLATES: MilestoneTemplate[] = [
    {
        title: "Mốc 1 - Khảo sát và chuẩn bị",
        allocationPercent: 25,
        cumulativePercent: 25,
        description:
            "Giải ngân cho giai đoạn khảo sát hiện trạng, lên kế hoạch chi tiết và mua vật tư ban đầu.",
    },
    {
        title: "Mốc 2 - Triển khai chính",
        allocationPercent: 45,
        cumulativePercent: 70,
        description:
            "Tiền được giải ngân sau khi có báo cáo tiến độ và cập nhật minh chứng kết quả triển khai.",
    },
    {
        title: "Mốc 3 - Hoàn thiện và nghiệm thu",
        allocationPercent: 30,
        cumulativePercent: 100,
        description:
            "Đợt cuối chỉ được mở khi dự án đã đạt mục tiêu cuối và công khai kết quả nghiệm thu.",
    },
];

function buildMilestoneTemplates(milestoneCount: number): MilestoneTemplate[] {
    if (milestoneCount <= 0) return [];
    if (milestoneCount === DEFAULT_MILESTONE_TEMPLATES.length) {
        return DEFAULT_MILESTONE_TEMPLATES;
    }

    const baseAllocation = Math.floor(100 / milestoneCount);
    const remainder = 100 - baseAllocation * milestoneCount;
    let cumulative = 0;

    return Array.from({ length: milestoneCount }, (_, index) => {
        const allocationPercent = baseAllocation + (index < remainder ? 1 : 0);
        cumulative += allocationPercent;
        const fallbackTemplate = DEFAULT_MILESTONE_TEMPLATES[index];

        return {
            title: fallbackTemplate?.title ?? `Mốc ${index + 1}`,
            allocationPercent,
            cumulativePercent: cumulative,
            description:
                fallbackTemplate?.description ??
                "Giải ngân theo tiến độ sau khi có báo cáo và minh chứng tương ứng.",
        };
    });
}

function isValidDateString(value?: string) {
    if (!value) return false;
    return !Number.isNaN(new Date(value).getTime());
}

function calcEstimatedMilestoneDate(
    startMs: number,
    endMs: number,
    cumulativePercent: number,
) {
    const safeStart = Number.isFinite(startMs) ? startMs : Date.now();
    const fallbackEnd = safeStart + 30 * 24 * 60 * 60 * 1000;
    const safeEnd =
        Number.isFinite(endMs) && endMs > safeStart ? endMs : fallbackEnd;
    const duration = safeEnd - safeStart;
    const ratio = Math.max(0, Math.min(cumulativePercent / 100, 1));
    return new Date(safeStart + Math.round(duration * ratio));
}

export function buildTimelineMilestones({
    campaignId,
    campaignDeadline,
    campaignCreatedAt,
    progressPercent,
    goalWei = 0n,
    totalRaisedWei = 0n,
    milestoneCount,
    campaignStatusLabel,
    currentMilestoneId,
}: BuildMilestonesInput): TimelineMilestone[] {
    const safeProgress = Math.max(0, Math.min(progressPercent, 100));
    const endMs = campaignDeadline > 0 ? campaignDeadline * 1000 : Date.now();
    const createdAtMs = isValidDateString(campaignCreatedAt)
        ? new Date(campaignCreatedAt as string).getTime()
        : Date.now();
    const normalizedMilestoneCount = Number.isFinite(milestoneCount)
        ? Math.max(0, Math.floor(Number(milestoneCount)))
        : DEFAULT_MILESTONE_TEMPLATES.length;
    const milestoneTemplates = buildMilestoneTemplates(
        normalizedMilestoneCount,
    );

    if (milestoneTemplates.length === 0) {
        return [];
    }

    const progressCurrentMilestoneIndex = milestoneTemplates.findIndex(
        (item) => safeProgress < item.cumulativePercent,
    );
    const normalizedProgressIndex =
        progressCurrentMilestoneIndex >= 0
            ? progressCurrentMilestoneIndex
            : milestoneTemplates.length - 1;

    const normalizedCurrentMilestoneId = Number.isFinite(currentMilestoneId)
        ? Math.max(
              0,
              Math.min(
                  Math.floor(Number(currentMilestoneId)),
                  Math.max(milestoneTemplates.length - 1, 0),
              ),
          )
        : null;

    const fundingComplete = goalWei > 0n && totalRaisedWei >= goalWei;
    const rawStatus = campaignStatusLabel ?? "active";
    /** Khi đã đủ vốn nhưng indexer còn ghi Active, coi như in_progress để M0 không còn “Sắp tới”. */
    const timelineCampaignStatus: CampaignStatusForTimeline =
        rawStatus === "active" && fundingComplete ? "in_progress" : rawStatus;

    return milestoneTemplates.map((template, index) => {
        const expectedDate = calcEstimatedMilestoneDate(
            createdAtMs,
            endMs,
            template.cumulativePercent,
        );
        const reached = safeProgress >= template.cumulativePercent;

        let status: MilestoneStatus = "upcoming";

        if (timelineCampaignStatus === "completed") {
            status = "completed";
        } else if (
            timelineCampaignStatus === "failed" ||
            timelineCampaignStatus === "cancelled"
        ) {
            status = "cancelled";
        } else if (timelineCampaignStatus === "partial_failed") {
            const failedIndex =
                normalizedCurrentMilestoneId ?? normalizedProgressIndex;
            if (index < failedIndex) {
                status = "completed";
            } else if (index === failedIndex) {
                status = "failed";
            } else {
                status = "upcoming";
            }
        } else if (timelineCampaignStatus === "in_progress") {
            const currentIndex =
                normalizedCurrentMilestoneId ?? normalizedProgressIndex;
            if (index < currentIndex) {
                status = "completed";
            } else if (index === currentIndex) {
                status =
                    expectedDate.getTime() < Date.now()
                        ? "delayed"
                        : "in_progress";
            } else {
                status = "upcoming";
            }
        } else if (timelineCampaignStatus === "active") {
            status = "upcoming";
        } else if (reached) {
            status = "completed";
        } else if (expectedDate.getTime() < Date.now()) {
            status = "delayed";
        } else if (normalizedProgressIndex === index) {
            status = "in_progress";
        }

        const allocationBps = Math.round(template.allocationPercent * 100);
        // Mục tiêu cố định: dựa trên goalWei (mục tiêu gây quỹ ban đầu)
        const targetAmountWei =
            goalWei > 0n && allocationBps > 0
                ? (goalWei * BigInt(allocationBps)) / 10000n
                : 0n;

        return {
            id: `${campaignId}-${index + 1}`,
            title: template.title,
            allocationPercent: template.allocationPercent,
            cumulativePercent: template.cumulativePercent,
            description: template.description,
            expectedDate,
            targetAmountWei,
            status,
        };
    });
}
