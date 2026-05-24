export type CampaignDescriptionParts = {
    location: string;
    context: string;
    plan: string;
    transparency: string;
};

export const EMPTY_CAMPAIGN_DESCRIPTION_PARTS: CampaignDescriptionParts = {
    location: "",
    context: "",
    plan: "",
    transparency: "",
};

export const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 1000;
export const CAMPAIGN_DESCRIPTION_MIN_RECOMMENDED = 200;

export const CAMPAIGN_DESCRIPTION_SECTIONS: Array<{
    key: keyof CampaignDescriptionParts;
    label: string;
    hint: string;
    placeholder: string;
    rows: number;
    maxPartLength: number;
}> = [
    {
        key: "location",
        label: "Địa điểm & đơn vị",
        hint: "Tên trường/tổ chức, địa chỉ cụ thể (phường, quận, tỉnh/thành).",
        placeholder:
            "Ví dụ: Trường THCS ABC — 123 Đường X, Phường Y, Quận Z, TP.HCM",
        rows: 2,
        maxPartLength: 280,
    },
    {
        key: "context",
        label: "Hoàn cảnh",
        hint: "Vì sao cần hỗ trợ, đối tượng thụ hưởng, tình trạng hiện tại.",
        placeholder:
            "Ví dụ: 120 học sinh đang thiếu bàn ghế và thiết bị học tập cơ bản sau mùa mưa.",
        rows: 3,
        maxPartLength: 320,
    },
    {
        key: "plan",
        label: "Mục tiêu & kế hoạch",
        hint: "Sẽ làm gì với số tiền, các hạng mục chính, thời gian dự kiến.",
        placeholder:
            "Ví dụ: Gây quỹ mua 40 bộ bàn ghế, 1 máy chiếu, sửa 2 phòng học trong 3 tháng.",
        rows: 3,
        maxPartLength: 320,
    },
    {
        key: "transparency",
        label: "Minh bạch",
        hint: "Cách báo cáo tiến độ, bằng chứng nghiệm thu sau từng mốc.",
        placeholder:
            "Ví dụ: Công khai hóa đơn, ảnh hiện trường và biên bản nghiệm thu sau mỗi mốc giải ngân.",
        rows: 2,
        maxPartLength: 280,
    },
];

/** Ghép các ô thành một chuỗi mô tả gửi backend (giữ định dạng có nhãn mục). */
export function composeCampaignDescription(
    parts: CampaignDescriptionParts,
): string {
    return CAMPAIGN_DESCRIPTION_SECTIONS.map((section) => {
        const value = (parts[section.key] || "").trim();
        if (!value) return "";
        return `${section.label}: ${value}`;
    })
        .filter(Boolean)
        .join("\n\n");
}

/** Tách chuỗi mô tả đã lưu về các ô (khi chỉnh sửa / khôi phục nháp). */
export function parseCampaignDescription(
    description: string,
): CampaignDescriptionParts {
    const trimmed = (description || "").trim();
    if (!trimmed) {
        return { ...EMPTY_CAMPAIGN_DESCRIPTION_PARTS };
    }

    const parts: CampaignDescriptionParts = {
        ...EMPTY_CAMPAIGN_DESCRIPTION_PARTS,
    };

    for (const section of CAMPAIGN_DESCRIPTION_SECTIONS) {
        const prefix = `${section.label}:`;
        const startIndex = trimmed.indexOf(prefix);
        if (startIndex === -1) continue;

        const contentStart = startIndex + prefix.length;
        let contentEnd = trimmed.length;

        for (const other of CAMPAIGN_DESCRIPTION_SECTIONS) {
            if (other.key === section.key) continue;
            const nextPrefix = `\n\n${other.label}:`;
            const nextIndex = trimmed.indexOf(nextPrefix, contentStart);
            if (nextIndex !== -1 && nextIndex < contentEnd) {
                contentEnd = nextIndex;
            }
        }

        parts[section.key] = trimmed.slice(contentStart, contentEnd).trim();
    }

    const anyParsed = Object.values(parts).some((value) => value.trim());
    if (!anyParsed) {
        parts.context = trimmed;
    }

    return parts;
}

export function validateCampaignDescriptionParts(
    parts: CampaignDescriptionParts,
): string | null {
    const missing = CAMPAIGN_DESCRIPTION_SECTIONS.filter(
        (section) => !(parts[section.key] || "").trim(),
    );
    if (missing.length > 0) {
        return `Vui lòng điền đầy đủ: ${missing.map((s) => s.label).join(", ")}.`;
    }

    const composed = composeCampaignDescription(parts);
    if (composed.length > CAMPAIGN_DESCRIPTION_MAX_LENGTH) {
        return `Mô tả tối đa ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} ký tự (hiện ${composed.length}).`;
    }

    return null;
}
