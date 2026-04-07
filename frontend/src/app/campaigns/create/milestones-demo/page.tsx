"use client";

import dynamic from "next/dynamic";

const MilestoneBuilder = dynamic(
    () => import("@/components/campaign-create/MilestoneBuilder"),
    { ssr: false },
);

const mockCampaignInfo = {
    title: "Dự án nước sạch vùng cao",
    totalGoal: 10,
    campaignDeadline: "2026-08-31",
};

const demoMilestones = [
    {
        name: "Khảo sát và thiết kế hệ thống",
        goal: 4,
        deadline: "2026-06-15",
        description:
            "Khảo sát địa điểm, thiết kế sơ bộ và chuẩn bị vật tư cho hệ thống nước sạch.",
    },
    {
        name: "Thi công và bàn giao",
        goal: 6,
        deadline: "2026-08-15",
        description:
            "Thi công, kiểm thử và bàn giao hệ thống nước sạch cho cộng đồng địa phương.",
    },
];

export default function MilestonesDemoPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto w-full max-w-6xl px-4 py-10">
                <MilestoneBuilder
                    campaignInfo={mockCampaignInfo}
                    initialMilestones={demoMilestones}
                    onSubmit={() => {}}
                    onBack={() => {}}
                />
            </div>
        </div>
    );
}
