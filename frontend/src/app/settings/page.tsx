'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { getUserProfile, toAuthUserProfile, updateUserProfile, useAuth } from '@/lib';

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const { token, user, setAuth } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const walletAddress = useMemo(() => address || user?.wallet || '', [address, user?.wallet]);
  const canEdit = Boolean(token && walletAddress);

  useEffect(() => {
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getUserProfile(walletAddress)
      .then((profile) => {
        if (cancelled) return;
        setDisplayName(profile.displayName || '');
        setAvatarDataUrl(profile.avatarUrl || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không tải được thông tin người dùng.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh (png/jpg/webp...).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ảnh đại diện tối đa 2MB.');
      return;
    }

    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc file ảnh.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canEdit) {
      setError('Bạn cần kết nối ví và đăng nhập để cập nhật hồ sơ.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateUserProfile(token, walletAddress, {
        displayName: displayName.trim(),
        avatarUrl: avatarDataUrl.trim(),
      });

      if (token) {
        setAuth(token, toAuthUserProfile(updated));
      }
      setSuccess('Đã lưu thông tin hồ sơ thành công.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Cài đặt tài khoản</h1>
            <p className="mt-3 text-sm text-slate-600">
              Bạn cần kết nối ví để quản lý hồ sơ cá nhân.
            </p>
            <Link
              href="/campaigns"
              className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Xem chiến dịch công khai
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Cài đặt tài khoản</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cập nhật thông tin hiển thị của bạn trong hệ thống.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ví đang dùng</p>
            <p className="mt-1 font-mono text-sm text-slate-800 break-all">{walletAddress}</p>
            <p className="mt-2 text-xs text-slate-500">Role: {user?.role || 'user'}</p>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-slate-600">Đang tải hồ sơ...</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="displayName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Tên hiển thị
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  placeholder="Ví dụ: Nguyen Van A"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="avatarFile" className="mb-2 block text-sm font-semibold text-slate-700">
                  Ảnh đại diện
                </label>
                <input
                  id="avatarFile"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
                />
                <p className="mt-1 text-xs text-slate-500">Hỗ trợ ảnh PNG/JPG/WEBP, tối đa 2MB.</p>
                {avatarDataUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={avatarDataUrl}
                      alt="Avatar preview"
                      className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAvatarDataUrl('')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={!canEdit || isSaving}
                className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
