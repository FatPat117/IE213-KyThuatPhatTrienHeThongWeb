"use client";

import { useMemo, useState } from "react";
import {
    CAMPAIGN_DESCRIPTION_MAX_LENGTH,
    CAMPAIGN_DESCRIPTION_MIN_RECOMMENDED,
    CAMPAIGN_DESCRIPTION_SECTIONS,
    composeCampaignDescription,
    parseCampaignDescription,
    type CampaignDescriptionParts,
} from "@/lib/utils/campaign-description-fields";

type CampaignDescriptionFieldsProps = {
    value: string;
    disabled?: boolean;
    error?: string | null;
    onChange: (composedDescription: string) => void;
};

function fieldCounterClass(current: number, max: number): string {
    if (max <= 0) return "field-counter";
    const ratio = current / max;
    if (ratio >= 0.95) return "field-counter danger";
    if (ratio >= 0.8) return "field-counter warning";
    return "field-counter";
}

function totalCounterTone(length: number): string {
    if (length > CAMPAIGN_DESCRIPTION_MAX_LENGTH) return "is-danger";
    if (length < CAMPAIGN_DESCRIPTION_MIN_RECOMMENDED) return "is-warning";
    return "";
}

export default function CampaignDescriptionFields({
    value,
    disabled = false,
    error,
    onChange,
}: CampaignDescriptionFieldsProps) {
    const [parts, setParts] = useState<CampaignDescriptionParts>(() =>
        parseCampaignDescription(value),
    );

    const composed = useMemo(() => composeCampaignDescription(parts), [parts]);
    const composedLength = composed.length;
    const totalPercent = Math.min(
        (composedLength / CAMPAIGN_DESCRIPTION_MAX_LENGTH) * 100,
        100,
    );

    const updatePart = (
        key: keyof CampaignDescriptionParts,
        nextValue: string,
    ) => {
        const section = CAMPAIGN_DESCRIPTION_SECTIONS.find(
            (item) => item.key === key,
        );
        const capped = section
            ? nextValue.slice(0, section.maxPartLength)
            : nextValue;
        const nextParts = { ...parts, [key]: capped };
        const nextComposed = composeCampaignDescription(nextParts);
        if (nextComposed.length > CAMPAIGN_DESCRIPTION_MAX_LENGTH) {
            return;
        }
        setParts(nextParts);
        onChange(nextComposed);
    };

    return (
        <div className="space-y-5">
            <div className="description-intro">
                <p className="field-label mb-1">Hướng dẫn viết mô tả</p>
                <p className="field-hint mb-0">
                    Điền từng mục bên dưới. Hệ thống sẽ tự ghép thành một mô tả
                    duy nhất khi lưu chiến dịch.
                </p>
            </div>

            {CAMPAIGN_DESCRIPTION_SECTIONS.map((section) => (
                <div key={section.key} className="form-field-group">
                    <label
                        htmlFor={`description-${section.key}`}
                        className="field-label"
                    >
                        {section.label}{" "}
                        <span className="text-red-400">*</span>
                    </label>
                    <p className="field-hint">{section.hint}</p>
                    <textarea
                        id={`description-${section.key}`}
                        name={`description-${section.key}`}
                        value={parts[section.key]}
                        onChange={(event) =>
                            updatePart(section.key, event.target.value)
                        }
                        disabled={disabled}
                        rows={section.rows}
                        placeholder={section.placeholder}
                        maxLength={section.maxPartLength}
                        className={`create-campaign-input ${error ? "create-campaign-input-error" : ""}`}
                    />
                    <p
                        className={fieldCounterClass(
                            parts[section.key].length,
                            section.maxPartLength,
                        )}
                    >
                        {parts[section.key].length}/{section.maxPartLength} ký
                        tự
                    </p>
                </div>
            ))}

            {error && <p className="field-error">{error}</p>}

            <div
                className={`total-description-counter ${totalCounterTone(composedLength)}`}
            >
                <div className="total-description-counter-header">
                    <span>Tổng mô tả (đã ghép)</span>
                    <span>
                        {composedLength}/{CAMPAIGN_DESCRIPTION_MAX_LENGTH} ký tự
                    </span>
                </div>
                {composedLength < CAMPAIGN_DESCRIPTION_MIN_RECOMMENDED && (
                    <p className="field-hint mb-0 mt-2 text-[13px]">
                        Nên từ {CAMPAIGN_DESCRIPTION_MIN_RECOMMENDED} ký tự trở
                        lên
                    </p>
                )}
                <div className="mini-bar" aria-hidden>
                    <div
                        className="mini-bar-fill"
                        style={{ width: `${totalPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
