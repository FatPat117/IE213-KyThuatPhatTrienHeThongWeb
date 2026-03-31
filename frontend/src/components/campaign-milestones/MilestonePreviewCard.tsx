'use client';

import Link from 'next/link';
import { buildTimelineMilestones } from '@/lib/utils/milestone-plan';

interface MilestonePreviewCardProps {
  campaignId: number;
  campaignDeadline: number;
  campaignCreatedAt?: string;
  progressPercent: number;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export default function MilestonePreviewCard({
  campaignId,
  campaignDeadline,
  campaignCreatedAt,
  progressPercent,
}: MilestonePreviewCardProps) {
  const milestones = buildTimelineMilestones({
    campaignId,
    campaignDeadline,
    campaignCreatedAt,
    progressPercent,
  });

  return (
    <Link href={`/campaigns/${campaignId}/milestones`} className="group block">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:border-blue-300 hover:shadow-md">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-bold text-slate-900">Các mốc giải ngân dự kiến</h3>
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              Xem timeline chi tiết →
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Thông tin giúp nhà tài trợ đánh giá mức độ minh bạch và kế hoạch sử dụng quỹ trước khi quyên góp.
          </p>
        </div>

        <div className="p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Tiến độ chiến dịch hiện tại</p>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {progressPercent.toFixed(1)}%
            </span>
          </div>

          <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-3">
            {milestones.map((milestone) => {
              const isReached = milestone.status === 'completed';

              return (
                <article
                  key={milestone.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{milestone.title}</p>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                        {milestone.allocationPercent}% ngân sách
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 ${
                          isReached ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isReached ? 'Đã đạt ngưỡng' : `Ngưỡng ${milestone.cumulativePercent}%`}
                      </span>
                    </div>
                  </div>

                  <p className="mb-2 text-sm leading-relaxed text-slate-600">{milestone.description}</p>
                  <p className="text-xs font-medium text-slate-500">
                    Hạn chót dự kiến: <span className="text-slate-700">{formatDate(milestone.expectedDate)}</span>
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Chú thích về giải ngân theo giai đoạn</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              Tiền quỹ không được rút một lần. Mỗi đợt giải ngân cần được mở khóa theo mốc tiến độ và được đối soát
              minh chứng kết quả. Cách này giúp nhà tài trợ giảm rủi ro và tăng tính minh bạch trước khi quyết định
              quyên góp.
            </p>
          </div>
        </div>
      </section>
    </Link>
  );
}
