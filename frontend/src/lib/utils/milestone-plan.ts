export type MilestoneTemplate = {
  title: string;
  allocationPercent: number;
  cumulativePercent: number;
  description: string;
};

export type MilestoneStatus = 'completed' | 'in_progress' | 'upcoming' | 'delayed';

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
  milestoneCount?: number;
};

export const DEFAULT_MILESTONE_TEMPLATES: MilestoneTemplate[] = [
  {
    title: 'Mốc 1 - Khảo sát và chuẩn bị',
    allocationPercent: 25,
    cumulativePercent: 25,
    description: 'Giải ngân cho giai đoạn khảo sát hiện trạng, lên kế hoạch chi tiết và mua vật tư ban đầu.',
  },
  {
    title: 'Mốc 2 - Triển khai chính',
    allocationPercent: 45,
    cumulativePercent: 70,
    description: 'Tiền được giải ngân sau khi có báo cáo tiến độ và cập nhật minh chứng kết quả triển khai.',
  },
  {
    title: 'Mốc 3 - Hoàn thiện và nghiệm thu',
    allocationPercent: 30,
    cumulativePercent: 100,
    description: 'Đợt cuối chỉ được mở khi dự án đã đạt mục tiêu cuối và công khai kết quả nghiệm thu.',
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
        'Giải ngân theo tiến độ sau khi có báo cáo và minh chứng tương ứng.',
    };
  });
}

function isValidDateString(value?: string) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function calcEstimatedMilestoneDate(startMs: number, endMs: number, cumulativePercent: number) {
  const safeStart = Number.isFinite(startMs) ? startMs : Date.now();
  const fallbackEnd = safeStart + 30 * 24 * 60 * 60 * 1000;
  const safeEnd = Number.isFinite(endMs) && endMs > safeStart ? endMs : fallbackEnd;
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
  milestoneCount,
}: BuildMilestonesInput): TimelineMilestone[] {
  const safeProgress = Math.max(0, Math.min(progressPercent, 100));
  const endMs = campaignDeadline > 0 ? campaignDeadline * 1000 : Date.now();
  const createdAtMs = isValidDateString(campaignCreatedAt)
    ? new Date(campaignCreatedAt as string).getTime()
    : Date.now();
  const normalizedMilestoneCount = Number.isFinite(milestoneCount)
    ? Math.max(0, Math.floor(Number(milestoneCount)))
    : DEFAULT_MILESTONE_TEMPLATES.length;
  const milestoneTemplates = buildMilestoneTemplates(normalizedMilestoneCount);

  const currentMilestoneIndex = milestoneTemplates.findIndex(
    (item) => safeProgress < item.cumulativePercent,
  );

  return milestoneTemplates.map((template, index) => {
    const expectedDate = calcEstimatedMilestoneDate(createdAtMs, endMs, template.cumulativePercent);
    const reached = safeProgress >= template.cumulativePercent;

    let status: MilestoneStatus = 'upcoming';
    if (reached) {
      status = 'completed';
    } else if (expectedDate.getTime() < Date.now()) {
      status = 'delayed';
    } else if (currentMilestoneIndex === index) {
      status = 'in_progress';
    }

    const targetAmountWei = goalWei > 0n
      ? (goalWei * BigInt(template.allocationPercent)) / 100n
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
