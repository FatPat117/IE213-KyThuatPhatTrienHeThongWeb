'use client';

import { useAuth, useReadCampaign } from '@/lib';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { useAccount } from 'wagmi';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

function normalizeApiBaseUrl(rawUrl?: string) {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

function toSafeInteger(value: string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function MilestoneEvidenceUploadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const { address, isConnected } = useAccount();

  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const campaignId = toSafeInteger(typeof idParam === 'string' ? idParam : undefined, NaN);
  const initialMilestoneId = toSafeInteger(searchParams.get('milestone'), -1);
  const sourceCid = (searchParams.get('sourceCid') || '').trim();
  const { campaign } = useReadCampaign(Number.isFinite(campaignId) ? campaignId : null);

  const [milestoneId] = useState(initialMilestoneId >= 0 ? initialMilestoneId : 0);
  const [title, setTitle] = useState('Báo cáo tiến độ');
  const [description, setDescription] = useState('Minh chứng tiến độ mốc giải ngân');
  const [evidenceType, setEvidenceType] = useState<'report' | 'photo' | 'video' | 'document'>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL), []);
  const isCreator =
    Boolean(address) &&
    Boolean(campaign?.creator) &&
    campaign.creator.toLowerCase() === address.toLowerCase();
  const canUpload = Boolean(token && isConnected && isCreator);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!Number.isFinite(campaignId)) {
      setErrorMessage('Campaign ID không hợp lệ.');
      return;
    }
    if (!token) {
      setErrorMessage('Bạn cần đăng nhập ví để upload minh chứng.');
      return;
    }
    if (!isConnected || !address) {
      setErrorMessage('Vui lòng kết nối ví trước khi upload.');
      return;
    }
    if (!isCreator) {
      setErrorMessage('Chỉ ví creator của campaign mới được upload minh chứng.');
      return;
    }
    if (!Number.isFinite(milestoneId) || milestoneId < 0) {
      setErrorMessage('Milestone ID không hợp lệ.');
      return;
    }
    if (!file) {
      setErrorMessage('Vui lòng chọn file minh chứng trước khi upload.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResultMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('evidenceType', evidenceType);

      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(
        `${apiBaseUrl}/milestones/${campaignId}/${milestoneId}/evidence`,
        {
          method: 'POST',
          headers,
          body: formData,
        }
      );

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || 'Upload thất bại');
      }

      const cid = payload?.data?.evidenceCid || payload?.data?.cid || payload?.data?.ipfsCid || '';
      if (typeof cid === 'string' && cid.trim()) {
        setResultMessage(`Upload thành công. CID: ${cid}`);
      } else {
        setResultMessage('Upload thành công.');
      }
      setFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể upload minh chứng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Milestones Evidence</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Upload ảnh minh chứng</h1>
            <p className="mt-1 text-sm text-slate-600">Campaign #{Number.isFinite(campaignId) ? campaignId : '-'}</p>
          </div>
          {Number.isFinite(campaignId) && (
            <Link
              href={`/campaigns/${campaignId}/milestones`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              Quay lại timeline
            </Link>
          )}
        </div>

        {!token && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bạn chưa đăng nhập ví. Cần ký xác thực để hệ thống phân quyền upload minh chứng.
          </div>
        )}
        {token && campaign && !isCreator && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Ví hiện tại không phải creator của campaign này nên không có quyền upload minh chứng.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {sourceCid && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">CID hiện tại</p>
              <p className="mt-1 break-all">{sourceCid}</p>
              <a
                href={`https://ipfs.io/ipfs/${sourceCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-medium text-blue-600 hover:text-blue-700"
              >
                Mở file CID hiện tại
              </a>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Milestone ID</span>
              <input
                type="number"
                value={milestoneId}
                readOnly
                disabled
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:ring"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Mã mốc lấy từ timeline, chỉ hiển thị để đối chiếu.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Loại bằng chứng</span>
              <select
                value={evidenceType}
                onChange={(event) => setEvidenceType(event.target.value as 'report' | 'photo' | 'video' | 'document')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:ring"
              >
                <option value="photo">Ảnh</option>
                <option value="report">Báo cáo</option>
                <option value="video">Video</option>
                <option value="document">Tài liệu</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Tiêu đề</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Mô tả</span>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">File minh chứng</span>
            <input
              type="file"
              accept="image/*,application/pdf,video/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-700"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting || !canUpload}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Đang upload...' : 'Upload minh chứng'}
          </button>

          {resultMessage && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {resultMessage}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
