'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth, useSubmitMilestoneProof } from '@/lib';

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

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MilestoneEvidenceUploadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const { submitMilestoneProof } = useSubmitMilestoneProof();

  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const campaignId = toSafeInteger(typeof idParam === 'string' ? idParam : undefined, NaN);
  const initialMilestoneId = toSafeInteger(searchParams.get('milestone'), 0);
  const sourceCid = (searchParams.get('sourceCid') || '').trim();

  const [milestoneId, setMilestoneId] = useState(initialMilestoneId > 0 ? initialMilestoneId : 0);
  const [title, setTitle] = useState('Báo cáo tiến độ');
  const [description, setDescription] = useState('Minh chứng tiến độ mốc giải ngân');
  const [evidenceType, setEvidenceType] = useState<'report' | 'photo' | 'video' | 'document'>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL), []);
  const previewType = useMemo(() => {
    if (!file?.type) return null;
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'application/pdf') return 'pdf';
    return 'file';
  }, [file]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const uploadEvidence = async (targetMilestoneId: number) => {
    const formData = new FormData();
    formData.append('file', file as File);
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('evidenceType', evidenceType);

    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(
      `${apiBaseUrl}/milestones/${campaignId}/${targetMilestoneId}/evidence`,
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

    return payload;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!Number.isFinite(campaignId)) {
      setErrorMessage('Campaign ID không hợp lệ.');
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
      let payload;
      let resolvedMilestoneId = milestoneId;
      try {
        payload = await uploadEvidence(milestoneId);
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message.toLowerCase() : '';
        const shouldTryZeroBasedFallback =
          milestoneId > 0 &&
          (message.includes('milestone') && message.includes('not found'));

        if (!shouldTryZeroBasedFallback) {
          throw uploadError;
        }

        // Some screens show milestone number as 1-based, while backend expects on-chain index (0-based).
        resolvedMilestoneId = milestoneId - 1;
        payload = await uploadEvidence(resolvedMilestoneId);
        setMilestoneId(resolvedMilestoneId);
      }

      const cidRaw =
        payload?.data?.contentHash ||
        payload?.data?.evidenceCid ||
        payload?.data?.cid ||
        payload?.data?.ipfsCid ||
        '';
      const cid = typeof cidRaw === 'string' ? cidRaw.trim() : '';

      if (!cid) {
        setResultMessage('Upload thành công nhưng không đọc được CID để ghi blockchain.');
        setFile(null);
        return;
      }

      try {
        const txHash = await submitMilestoneProof(campaignId, resolvedMilestoneId, cid);

        setResultMessage(
          `Upload và ghi blockchain thành công (milestone index: ${resolvedMilestoneId}). CID: ${cid}. Tx: ${txHash}`
        );
      } catch (chainError) {
        const chainMessage = chainError instanceof Error ? chainError.message : 'Không thể ghi CID lên blockchain';
        setErrorMessage(`Upload IPFS thành công (CID: ${cid}) nhưng ghi blockchain thất bại: ${chainMessage}`);
        return;
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
            Bạn chưa đăng nhập ví. Một số campaign có thể từ chối upload nếu thiếu token xác thực.
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
              <span className="mb-1 block text-sm font-semibold text-slate-700">Milestone ID (on-chain index)</span>
              <input
                type="number"
                min={0}
                value={milestoneId}
                onChange={(event) => setMilestoneId(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:ring"
              />
              <p className="mt-1 text-xs text-slate-500">
                Lưu ý: index mốc trên smart contract thường bắt đầu từ 0.
              </p>
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
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResultMessage(null);
                setErrorMessage(null);
              }}
              className="block w-full text-sm text-slate-700"
            />
          </label>

          {file && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(file.size)} • {file.type || 'unknown'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
                >
                  Xóa file
                </button>
              </div>

              {previewType === 'image' && previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview minh chứng"
                  className="max-h-72 w-full rounded-lg border border-slate-200 object-contain bg-white"
                />
              )}

              {previewType === 'video' && previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-72 w-full rounded-lg border border-slate-200 bg-black"
                />
              )}

              {previewType === 'pdf' && previewUrl && (
                <iframe
                  src={previewUrl}
                  title="PDF preview"
                  className="h-72 w-full rounded-lg border border-slate-200 bg-white"
                />
              )}

              {previewType === 'file' && (
                <p className="text-xs text-slate-600">
                  Loại file này chưa hỗ trợ preview trực tiếp, bạn vẫn có thể upload bình thường.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
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
