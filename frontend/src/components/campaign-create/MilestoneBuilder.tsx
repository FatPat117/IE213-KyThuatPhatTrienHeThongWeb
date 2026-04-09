"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CampaignBasicInfo {
    title: string;
    totalGoal: number;
    campaignDeadline: string; // funding deadline (ISO or date)
}

interface Milestone {
    name: string;
    goal: number;
    deadline: string;
    description: string;
}

interface MilestoneBuilderProps {
    campaignInfo: CampaignBasicInfo;
    onSubmit: (milestones: Milestone[]) => void;
    onBack: () => void;
    initialMilestones?: Milestone[];
}

type MilestoneField = "name" | "goal" | "deadline" | "description";

type MilestoneForm = {
    id: string;
    name: string;
    goal: string;
    deadline: string;
    description: string;
};

type FieldErrors = Partial<Record<MilestoneField, string>>;

type FieldTouched = Partial<Record<MilestoneField, boolean>>;

const MAX_MILESTONES = 10;
const MIN_DESCRIPTION_LENGTH = 20;

const createEmptyMilestone = (): MilestoneForm => ({
    id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    goal: "",
    deadline: "",
    description: "",
});

const formatDateInput = (value: string): string => {
    if (!value) return "";
    const timestamp = normalizeDateValue(value);
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const toFormMilestone = (milestone: Milestone): MilestoneForm => ({
    id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: milestone.name,
    goal: Number.isFinite(milestone.goal) ? milestone.goal.toString() : "",
    deadline: formatDateInput(milestone.deadline),
    description: milestone.description,
});

const parseEth = (value: string): number => {
    if (!value) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatEth = (value: number): string => {
    if (!Number.isFinite(value)) return "0";
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
};

const normalizeDateValue = (value: string): number | null => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
};

export default function MilestoneBuilder({
    campaignInfo,
    onSubmit,
    onBack,
    initialMilestones,
}: MilestoneBuilderProps) {
    const [milestones, setMilestones] = useState<MilestoneForm[]>(() => {
        if (initialMilestones && initialMilestones.length > 0) {
            return initialMilestones
                .slice(0, MAX_MILESTONES)
                .map(toFormMilestone);
        }
        return [createEmptyMilestone()];
    });
    const [touched, setTouched] = useState<Record<string, FieldTouched>>({});
    const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(
        null,
    );

    const totalGoal = campaignInfo.totalGoal;

    const totalAllocated = useMemo(
        () =>
            milestones.reduce(
                (sum, milestone) => sum + parseEth(milestone.goal),
                0,
            ),
        [milestones],
    );

    const allocationPercent =
        totalGoal > 0 ? Math.min((totalAllocated / totalGoal) * 100, 200) : 0;
    const totalMatches = Math.abs(totalAllocated - totalGoal) < 0.00001;

    const allocationStatus =
        totalAllocated > totalGoal
            ? "over"
            : totalMatches
              ? "complete"
              : "under";

    const progressColor =
        allocationStatus === "complete"
            ? "bg-emerald-500"
            : allocationStatus === "over"
              ? "bg-rose-500"
              : "bg-amber-400";

    const progressTextColor =
        allocationStatus === "complete"
            ? "text-emerald-700"
            : allocationStatus === "over"
              ? "text-rose-700"
              : "text-amber-700";

    const progressBorderColor =
        allocationStatus === "complete"
            ? "border-emerald-200"
            : allocationStatus === "over"
              ? "border-rose-200"
              : "border-amber-200";
    const [nowTs] = useState(() => Date.now());

    const validateField = (
        field: MilestoneField,
        value: string,
    ): string | null => {
        if (field === "name") {
            return value.trim() ? null : "Vui lòng nhập tên mốc";
        }

        if (field === "goal") {
            if (!value.trim()) return "Vui lòng nhập mục tiêu tài chính";
            const parsed = Number(value);
            if (!Number.isFinite(parsed))
                return "Mục tiêu tài chính phải là số hợp lệ";
            if (parsed <= 0) return "Mục tiêu tài chính phải lớn hơn 0";
            return null;
        }

        if (field === "deadline") {
            if (!value.trim()) return "Vui lòng chọn hạn chót cho mốc";
            const milestoneTime = normalizeDateValue(value);
            if (milestoneTime === null) return "Hạn chót không hợp lệ";
            if (milestoneTime <= nowTs) return "Hạn chót mốc phải ở tương lai";
            const campaignTime = normalizeDateValue(
                campaignInfo.campaignDeadline,
            );
            if (campaignTime !== null && milestoneTime <= campaignTime) {
                return "Hạn chót mốc phải sau hạn chót gây quỹ";
            }
            return null;
        }

        if (field === "description") {
            if (!value.trim()) return "Vui lòng nhập mô tả";
            if (value.trim().length < MIN_DESCRIPTION_LENGTH) {
                return `Mô tả tối thiểu ${MIN_DESCRIPTION_LENGTH} ký tự`;
            }
            return null;
        }

        return null;
    };

    const validateMilestone = (milestone: MilestoneForm): FieldErrors => {
        const milestoneErrors: FieldErrors = {};
        (
            ["name", "goal", "deadline", "description"] as MilestoneField[]
        ).forEach((field) => {
            const error = validateField(field, milestone[field]);
            if (error) milestoneErrors[field] = error;
        });
        return milestoneErrors;
    };

    const handleFieldChange = (
        id: string,
        field: MilestoneField,
        value: string,
    ) => {
        setMilestones((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, [field]: value } : item,
            ),
        );

        const isTouched = touched[id]?.[field];
        if (isTouched) {
            setErrors((prev) => {
                const updated = { ...prev };
                const current = updated[id] ? { ...updated[id] } : {};
                const error = validateField(field, value);
                if (error) current[field] = error;
                else delete current[field];
                updated[id] = current;
                return updated;
            });
        }

        if (submitError) setSubmitError(null);
    };

    const handleBlur = (id: string, field: MilestoneField, value: string) => {
        setTouched((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: true },
        }));

        setErrors((prev) => {
            const updated = { ...prev };
            const current = updated[id] ? { ...updated[id] } : {};
            const error = validateField(field, value);
            if (error) current[field] = error;
            else delete current[field];
            updated[id] = current;
            return updated;
        });
    };

    const handleAddMilestone = () => {
        if (milestones.length >= MAX_MILESTONES) return;
        setMilestones((prev) => [...prev, createEmptyMilestone()]);
    };

    const handleRemoveMilestone = (id: string) => {
        if (milestones.length <= 1) return;
        setMilestones((prev) => prev.filter((item) => item.id !== id));
        setErrors((prev) => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setTouched((prev) => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
    };

    const moveMilestone = (index: number, direction: "up" | "down") => {
        setMilestones((prev) => {
            const updated = [...prev];
            const newIndex = direction === "up" ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= updated.length) return prev;
            const [moved] = updated.splice(index, 1);
            updated.splice(newIndex, 0, moved);
            return updated;
        });
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const updatedErrors: Record<string, FieldErrors> = {};
        const updatedTouched: Record<string, FieldTouched> = { ...touched };

        milestones.forEach((milestone) => {
            updatedErrors[milestone.id] = validateMilestone(milestone);
            updatedTouched[milestone.id] = {
                name: true,
                goal: true,
                deadline: true,
                description: true,
            };
        });

        setErrors(updatedErrors);
        setTouched(updatedTouched);

        if (!totalMatches) {
            setSubmitError(
                `Tổng mục tiêu các mốc (${formatEth(totalAllocated)} ETH) chưa bằng mục tiêu chiến dịch (${formatEth(
                    totalGoal,
                )} ETH). Vui lòng điều chỉnh.`,
            );
            return;
        }

        const hasErrors = Object.values(updatedErrors).some(
            (milestoneErrors) => Object.keys(milestoneErrors).length > 0,
        );

        if (hasErrors) return;

        const payload: Milestone[] = milestones.map((milestone) => ({
            name: milestone.name.trim(),
            goal: parseEth(milestone.goal),
            deadline: new Date(milestone.deadline).toISOString(),
            description: milestone.description.trim(),
        }));

        onSubmit(payload);
    };

    const allFieldsValid = milestones.every((milestone) => {
        const milestoneErrors = validateMilestone(milestone);
        return Object.keys(milestoneErrors).length === 0;
    });

    const canSubmit = allFieldsValid && totalMatches;

    const submitTooltip = (() => {
        if (milestones.length === 0) return "Cần ít nhất 1 mốc.";
        if (!allFieldsValid) return "Vui lòng hoàn tất tất cả trường bắt buộc.";
        if (!totalMatches) {
            return "Tổng mục tiêu các mốc chưa bằng mục tiêu chiến dịch.";
        }
        return "Sẵn sàng tiếp tục.";
    })();

    const campaignDeadlineLabel = useMemo(() => {
        const parsed = normalizeDateValue(campaignInfo.campaignDeadline);
        if (!parsed) return campaignInfo.campaignDeadline;
        return new Date(parsed).toLocaleDateString("vi-VN");
    }, [campaignInfo.campaignDeadline]);

    const remainingGoal = totalGoal - totalAllocated;
    const deadlineMinDateTime = (() => {
        const campaignTime = normalizeDateValue(campaignInfo.campaignDeadline);
        const minBase = campaignTime ? campaignTime + 60_000 : nowTs + 60_000;
        const minDate = new Date(minBase);
        const yyyy = minDate.getFullYear();
        const mm = String(minDate.getMonth() + 1).padStart(2, "0");
        const dd = String(minDate.getDate()).padStart(2, "0");
        const hh = String(minDate.getHours()).padStart(2, "0");
        const min = String(minDate.getMinutes()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    })();

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                Bước thiết lập mốc
                            </h2>
                            <p className="text-sm text-slate-600">
                                Khai báo các mốc giải ngân cho chiến dịch:{" "}
                                <span className="font-semibold">
                                    {campaignInfo.title}
                                </span>
                            </p>
                        </div>
                        {milestones.length < MAX_MILESTONES ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddMilestone}
                            >
                                Thêm mốc
                            </Button>
                        ) : (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Đã đạt tối đa {MAX_MILESTONES} mốc
                            </div>
                        )}
                    </div>

                    <div className="space-y-5">
                        {milestones.map((milestone, index) => {
                            const milestoneErrors = errors[milestone.id] || {};
                            const isActive = activeMilestoneId === milestone.id;
                            const canMoveUp = index > 0;
                            const canMoveDown = index < milestones.length - 1;
                            return (
                                <Card
                                    key={milestone.id}
                                    className={cn(
                                        "rounded-2xl border-2 bg-white shadow-sm transition",
                                        isActive
                                            ? "border-blue-400 ring-1 ring-blue-100"
                                            : "border-slate-200",
                                    )}
                                >
                                    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="text-sm font-semibold text-slate-700">
                                            Mốc {index + 1}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {canMoveUp && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        moveMilestone(index, "up")
                                                    }
                                                >
                                                    Di chuyển lên
                                                </Button>
                                            )}
                                            {canMoveDown && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        moveMilestone(index, "down")
                                                    }
                                                >
                                                    Di chuyển xuống
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    handleRemoveMilestone(
                                                        milestone.id,
                                                    )
                                                }
                                                disabled={milestones.length <= 1}
                                                className={cn(
                                                    milestones.length <= 1
                                                        ? "border-slate-200 text-slate-400"
                                                        : "border-rose-200 text-rose-600 hover:bg-rose-50",
                                                )}
                                            >
                                                Xóa mốc
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormItem>
                                            <Label>
                                                Tên mốc{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                type="text"
                                                value={milestone.name}
                                                onChange={(event) =>
                                                    handleFieldChange(
                                                        milestone.id,
                                                        "name",
                                                        event.target.value,
                                                    )
                                                }
                                                onFocus={() =>
                                                    setActiveMilestoneId(
                                                        milestone.id,
                                                    )
                                                }
                                                onBlur={(event) =>
                                                    handleBlur(
                                                        milestone.id,
                                                        "name",
                                                        event.target.value,
                                                    )
                                                }
                                                className={cn(
                                                    milestoneErrors.name
                                                        ? "border-rose-400 focus-visible:ring-rose-200"
                                                        : "border-slate-200",
                                                )}
                                                placeholder="Ví dụ: Hoàn thiện sản phẩm mẫu"
                                            />
                                            {milestoneErrors.name && (
                                                <p className="text-destructive text-sm">
                                                    {milestoneErrors.name}
                                                </p>
                                            )}
                                        </FormItem>

                                        <FormItem>
                                            <Label>
                                                Mục tiêu tài chính (ETH){" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={milestone.goal}
                                                    onChange={(event) =>
                                                        handleFieldChange(
                                                            milestone.id,
                                                            "goal",
                                                            event.target.value,
                                                        )
                                                    }
                                                    onFocus={() =>
                                                        setActiveMilestoneId(
                                                            milestone.id,
                                                        )
                                                    }
                                                    onBlur={(event) =>
                                                        handleBlur(
                                                            milestone.id,
                                                            "goal",
                                                            event.target.value,
                                                        )
                                                    }
                                                    min="0"
                                                    step="0.001"
                                                    className={cn(
                                                        "pr-12",
                                                        milestoneErrors.goal
                                                            ? "border-rose-400 focus-visible:ring-rose-200"
                                                            : "border-slate-200",
                                                    )}
                                                    placeholder="2.5"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                                                    ETH
                                                </span>
                                            </div>
                                            {milestoneErrors.goal && (
                                                <p className="text-destructive text-sm">
                                                    {milestoneErrors.goal}
                                                </p>
                                            )}
                                        </FormItem>

                                        <FormItem>
                                            <Label>
                                                Hạn chót mốc{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <Input
                                                type="datetime-local"
                                                value={milestone.deadline}
                                                onChange={(event) =>
                                                    handleFieldChange(
                                                        milestone.id,
                                                        "deadline",
                                                        event.target.value,
                                                    )
                                                }
                                                onFocus={() =>
                                                    setActiveMilestoneId(
                                                        milestone.id,
                                                    )
                                                }
                                                onBlur={(event) =>
                                                    handleBlur(
                                                        milestone.id,
                                                        "deadline",
                                                        event.target.value,
                                                    )
                                                }
                                                min={deadlineMinDateTime}
                                                className={cn(
                                                    milestoneErrors.deadline
                                                        ? "border-rose-400 focus-visible:ring-rose-200"
                                                        : "border-slate-200",
                                                )}
                                            />
                                            {milestoneErrors.deadline && (
                                                <p className="text-destructive text-sm">
                                                    {milestoneErrors.deadline}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-500">
                                                Hạn chót gây quỹ: {campaignDeadlineLabel}
                                            </p>
                                        </FormItem>

                                        <FormItem className="md:col-span-2">
                                            <Label>
                                                Mô tả công việc{" "}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </Label>
                                            <Textarea
                                                value={milestone.description}
                                                onChange={(event) =>
                                                    handleFieldChange(
                                                        milestone.id,
                                                        "description",
                                                        event.target.value,
                                                    )
                                                }
                                                onFocus={() =>
                                                    setActiveMilestoneId(
                                                        milestone.id,
                                                    )
                                                }
                                                onBlur={(event) =>
                                                    handleBlur(
                                                        milestone.id,
                                                        "description",
                                                        event.target.value,
                                                    )
                                                }
                                                rows={3}
                                                className={cn(
                                                    milestoneErrors.description
                                                        ? "border-rose-400 focus-visible:ring-rose-200"
                                                        : "border-slate-200",
                                                )}
                                                placeholder="Mô tả ngắn về hạng mục sẽ hoàn thành"
                                            />
                                            <div className="text-xs text-slate-500">
                                                {milestone.description.trim().length}/
                                                {MIN_DESCRIPTION_LENGTH} ký tự tối
                                                thiểu
                                            </div>
                                            {milestoneErrors.description && (
                                                <p className="text-destructive text-sm">
                                                    {milestoneErrors.description}
                                                </p>
                                            )}
                                        </FormItem>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4 lg:sticky lg:top-6 h-fit">
                    <Card className={cn("border-2", progressBorderColor)}>
                        <CardHeader className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">
                                        Tiến trình phân bổ
                                    </p>
                                    <p className={cn("text-lg font-bold", progressTextColor)}>
                                        {formatEth(totalAllocated)} / {formatEth(totalGoal)} ETH — {Math.round(allocationPercent)}%
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-semibold",
                                        allocationStatus === "complete"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : allocationStatus === "over"
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-amber-100 text-amber-700",
                                    )}
                                >
                                    {allocationStatus === "complete"
                                        ? "Đạt 100%"
                                        : allocationStatus === "over"
                                          ? "Vượt mức"
                                          : "Chưa đủ"}
                                </span>
                            </div>
                            <Progress
                                value={Math.min(allocationPercent, 100)}
                                indicatorClassName={progressColor}
                            />
                            {submitError && (
                                <p className="text-destructive text-sm">
                                    {submitError}
                                </p>
                            )}
                        </CardHeader>
                    </Card>

                    <Card className="bg-slate-50">
                        <CardHeader>
                            <h3 className="text-sm font-semibold text-slate-700">
                                Tóm tắt chiến dịch
                            </h3>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex justify-between">
                                    <span>Mục tiêu tổng</span>
                                    <span className="font-semibold text-slate-900">
                                        {formatEth(totalGoal)} ETH
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Đã phân bổ</span>
                                    <span className="font-semibold text-slate-900">
                                        {formatEth(totalAllocated)} ETH
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>
                                        {remainingGoal >= 0 ? "Còn thiếu" : "Vượt"}
                                    </span>
                                    <span
                                        className={cn(
                                            "font-semibold",
                                            remainingGoal >= 0
                                                ? "text-amber-700"
                                                : "text-rose-700",
                                        )}
                                    >
                                        {formatEth(Math.abs(remainingGoal))} ETH
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Hạn chót</span>
                                    <span className="font-semibold text-slate-900">
                                        {campaignDeadlineLabel}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Số mốc</span>
                                    <span className="font-semibold text-slate-900">
                                        {milestones.length}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-100 bg-blue-50">
                        <CardHeader>
                            <h3 className="text-sm font-semibold text-blue-700">
                                Gợi ý thiết lập
                            </h3>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-sm text-blue-700 space-y-2">
                                <li>
                                    Mỗi mốc nên tương ứng với một kết quả có thể
                                    kiểm chứng.
                                </li>
                                <li>
                                    Chia nhỏ mục tiêu để dễ theo dõi tiến độ và
                                    giải ngân.
                                </li>
                                <li>
                                    Hạn chế đặt quá nhiều mốc trong một chiến
                                    dịch.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    className="px-6 py-3"
                >
                    Quay lại
                </Button>
                {canSubmit ? (
                    <Button type="submit" className="flex-1 h-12 text-base">
                        Tiếp tục
                    </Button>
                ) : (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex-1">
                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-base"
                                        disabled
                                    >
                                        Tiếp tục
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{submitTooltip}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </form>
    );
}
