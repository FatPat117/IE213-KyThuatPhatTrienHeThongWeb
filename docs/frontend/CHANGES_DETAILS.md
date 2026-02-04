# Chi tiết thay đổi từng trang

## 1. Trang Chủ - `app/page.tsx`

### Thay đổi:

#### a. Import và Constants

```typescript
// Thêm imports
import { useChainId } from "wagmi";
import { useEffect, useState } from "react";

// Thêm constant
const SEPOLIA_CHAIN_ID = 11155111;
```

#### b. State Management

```typescript
const { isConnected } = useAccount();
const chainId = useChainId();
const [hasProvider, setHasProvider] = useState<boolean | null>(null);
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

// Kiểm tra MetaMask khi component mount
useEffect(() => {
    if (typeof window !== "undefined") {
        setHasProvider(Boolean((window as any).ethereum));
    }
}, []);
```

#### c. Hero Section - Status Badges

Thêm status badge hiển thị trạng thái:

```tsx
<div className="inline-flex items-center gap-2 w-fit flex-wrap">
    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
        🔗 Được hỗ trợ bởi Blockchain
    </span>
    {!isConnected && (
        <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
            👁️ Chế độ xem (read-only)
        </span>
    )}
    {isConnected && !isSepoliaNetwork && (
        <span className="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
            ⚠️ Sai mạng
        </span>
    )}
    {isConnected && isSepoliaNetwork && (
        <span className="text-xs font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
            ✓ Kết nối Sepolia
        </span>
    )}
</div>
```

#### d. Thông báo MetaMask

```tsx
{
    !hasProvider && hasProvider !== null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">
                ⚠️ Chưa có MetaMask
            </p>
            <p className="text-xs text-amber-800 mb-3">
                Bạn vẫn có thể xem dữ liệu ở chế độ read-only...
            </p>
            <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
            >
                Cài đặt MetaMask
            </a>
        </div>
    );
}
```

#### e. Kiểm tra kết nối và mạng

```tsx
{
    isConnected && !isSepoliaNetwork && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900 mb-1">
                ⚠️ Mạng lưới sai
            </p>
            <p className="text-xs text-red-800 mb-3">
                Vui lòng chuyển sang mạn Sepolia...
            </p>
        </div>
    );
}
```

#### f. Navigation Menu - Bảo vệ chức năng

```tsx
{
    isConnected && isSepoliaNetwork ? (
        <>
            <Link href="/campaigns/create">Tạo mới</Link>
            <Link href="/donations">Quyên góp của tôi</Link>
            <Link href="/my-campaigns">Chiến dịch của tôi</Link>
        </>
    ) : (
        <>
            <span className="text-slate-400 cursor-not-allowed" title="...">
                Tạo mới
            </span>
            <span className="text-slate-400 cursor-not-allowed" title="...">
                Quyên góp của tôi
            </span>
            <span className="text-slate-400 cursor-not-allowed" title="...">
                Chiến dịch của tôi
            </span>
        </>
    );
}
```

#### g. CTA Buttons - Bảo vệ tạo chiến dịch

```tsx
{
    isConnected && isSepoliaNetwork ? (
        <Link href="/campaigns/create">Bắt đầu chiến dịch</Link>
    ) : (
        <button
            className="bg-slate-200 text-slate-600 cursor-not-allowed"
            disabled
        >
            Bắt đầu chiến dịch
        </button>
    );
}
```

---

## 2. Trang Danh Sách Chiến Dịch - `app/campaigns/page.tsx`

### Thay đổi:

#### a. Imports

```typescript
import { useAccount, useChainId } from "wagmi";

const SEPOLIA_CHAIN_ID = 11155111;
```

#### b. State và Kiểm tra

```typescript
const { isConnected } = useAccount();
const chainId = useChainId();
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
const canCreateCampaign = isConnected && isSepoliaNetwork;
```

#### c. Status Banner ở đầu trang

```tsx
{
    !isConnected && (
        <div className="mb-6 rounded-lg border border-blue-300 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
                👁️ Chế độ xem (read-only)
            </p>
            <p className="text-xs text-blue-800 mt-1">
                Bạn đang xem dữ liệu ở chế độ read-only. Kết nối ví để tạo chiến
                dịch...
            </p>
        </div>
    );
}

{
    isConnected && !isSepoliaNetwork && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">
                ⚠️ Mạng lưới sai
            </p>
            <p className="text-xs text-red-800 mt-1">
                Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch...
            </p>
        </div>
    );
}
```

#### d. Nút Tạo Chiến Dịch - Bảo vệ

```tsx
{
    canCreateCampaign ? (
        <Link href="/campaigns/create">+ Tạo chiến dịch</Link>
    ) : (
        <button
            disabled
            title={
                !isConnected
                    ? "Kết nối ví để tạo chiến dịch"
                    : "Chuyển sang mạng Sepolia"
            }
            className="bg-slate-300 text-slate-600 cursor-not-allowed"
        >
            + Tạo chiến dịch
        </button>
    );
}
```

---

## 3. Component WalletConnectButton - `app/components/WalletConnectButton.tsx`

### Thay đổi lớn:

#### a. Kiểm tra MetaMask

```typescript
const [hasProvider, setHasProvider] = useState<boolean | null>(null);

useEffect(() => {
  if (typeof window !== 'undefined') {
    setHasProvider(Boolean((window as any).ethereum));
  }
}, []);

// Hiển thị nếu không có MetaMask
if (!hasProvider && hasProvider !== null) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ Chưa có MetaMask</p>
      <a href="https://metamask.io/download/" target="_blank">
        Cài đặt MetaMask
      </a>
    </div>
  );
}
```

#### b. Xử lý trạng thái loading

```typescript
const { connect, isPending } = useConnect();

<button disabled={isPending || !hasProvider}>
  {isPending ? 'Đang kết nối...' : 'Kết nối ví'}
</button>
```

#### c. Kiểm tra mạng Sepolia

```typescript
const SEPOLIA_CHAIN_ID = 11155111;
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

{!isSepoliaNetwork && (
  <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg">
    <p className="text-sm font-semibold text-red-900 mb-2">
      ⚠️ Mạng lưới sai
    </p>
    <button onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}>
      Hướng dẫn chuyển mạng
    </button>
  </div>
)}

{isSepoliaNetwork && (
  <div className="px-4 py-2 bg-green-50 border border-green-300 rounded-lg">
    <p className="text-xs text-green-700 font-semibold">
      ✓ Kết nối Sepolia thành công
    </p>
  </div>
)}
```

---

## 4. Trang Tạo Chiến Dịch - `app/campaigns/create/page.tsx`

### Thay đổi:

#### a. Sử dụng useChainId thay vì chain object

```typescript
import { useAccount, useWaitForTransactionReceipt, useChainId } from "wagmi";

const { isConnected } = useAccount();
const chainId = useChainId();
const SEPOLIA_CHAIN_ID = 11155111;
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
```

#### b. Kiểm tra mạng - cập nhật

```typescript
if (!isSepoliaNetwork) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Sai mạng
        </h1>
        <p className="text-slate-600 mb-4">
          Vui lòng chuyển sang mạn Sepolia để tạo chiến dịch.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">
            Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)
          </p>
        </div>
        <button onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}>
          Hướng dẫn đổi mạng
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Trang Chi Tiết Chiến Dịch - `app/campaigns/[id]/page.tsx`

### Thay đổi:

#### a. Sử dụng useChainId

```typescript
import { useAccount, useWaitForTransactionReceipt, useChainId } from "wagmi";

const { address, isConnected } = useAccount();
const chainId = useChainId();
const isSepolia = chainId === 11155111;
const canDonate = Boolean(
    isConnected && isSepolia && campaign && !campaign.completed,
);
```

#### b. Thông báo khi chưa kết nối

```tsx
{
    !isConnected && (
        <div className="mb-4 rounded-lg bg-white/10 border border-white/30 px-4 py-3">
            <p className="text-sm text-blue-100">
                🔐 Vui lòng kết nối ví để quyên góp. Bạn vẫn có thể xem dữ liệu
                ở chế độ read-only.
            </p>
        </div>
    );
}
```

#### c. Thông báo mạng sai

```tsx
{
    isConnected && !isSepolia && (
        <div className="mb-4 rounded-lg bg-yellow-500/20 border border-yellow-200/40 px-4 py-3">
            <p className="text-sm text-yellow-100">
                ⚠️ Sai mạng. Vui lòng chuyển sang Sepolia để quyên góp.
            </p>
            <button
                onClick={() =>
                    window.open(
                        "https://chainlist.org/?search=sepolia",
                        "_blank",
                    )
                }
            >
                Hướng dẫn đổi mạng
            </button>
        </div>
    );
}
```

#### d. Nút Quyên Góp - Bảo vệ

```tsx
<button
    onClick={handleDonate}
    disabled={
        !canDonate || isPending || isConfirming || parseFloat(amount) <= 0
    }
    className="... disabled:opacity-50"
>
    {isPending
        ? "⏳ Đợi xác nhận từ ví..."
        : isConfirming
          ? "🔄 Đang xác nhận..."
          : !isConnected
            ? "Kết nối ví để quyên góp"
            : !isSepolia
              ? "Sai mạng"
              : campaign.completed
                ? "Chiến dịch đã kết thúc"
                : "💝 Quyên góp"}
</button>
```

---

## 6. Trang Lịch Sử Quyên Góp - `app/donations/page.tsx`

### Thay đổi:

#### a. Cập nhật thông báo khi chưa kết nối (tiếng Việt)

```typescript
if (!isConnected) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Cần kết nối ví
        </h1>
        <p className="text-slate-600">
          Vui lòng kết nối ví để xem lịch sử quyên góp của bạn.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 <strong>Lưu ý:</strong> Lịch sử quyên góp sẽ được lấy từ blockchain Sepolia.
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### b. Cập nhật thông báo mạng sai (tiếng Việt)

```typescript
if (chain?.id !== 11155111) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Sai mạng lưới
      </h1>
      <p className="text-slate-600 mb-4">
        Vui lòng chuyển sang mạng Sepolia để xem lịch sử quyên góp.
      </p>
    </div>
  );
}
```

---

## 7. Trang Chiến Dịch Của Tôi - `app/my-campaigns/page.tsx`

### Thay đổi:

- Kiểm tra kết nối và mạng (đã có, không cần sửa)
- Tiếng Việt của thông báo (đã có)

---

## 8. Trang Chỉnh Sửa Chiến Dịch - `app/campaigns/[id]/edit/page.tsx`

### Thay đổi:

- Kiểm tra kết nối và mạng (đã có, không cần sửa)

---

## Tóm Tắt Thay Đổi

| File                                     | Thay đổi chính                                      |
| ---------------------------------------- | --------------------------------------------------- |
| `app/page.tsx`                           | Kiểm tra MetaMask, thêm status badge, bảo vệ CTA    |
| `app/campaigns/page.tsx`                 | Thêm status banner, bảo vệ nút tạo chiến dịch       |
| `app/campaigns/create/page.tsx`          | Sửa kiểm tra mạng, sử dụng useChainId               |
| `app/campaigns/[id]/page.tsx`            | Kiểm tra mạng, thông báo read-only, bảo vệ donate   |
| `app/donations/page.tsx`                 | Cập nhật thông báo tiếng Việt                       |
| `app/components/WalletConnectButton.tsx` | Kiểm tra MetaMask, isPending, kiểm tra mạng rõ ràng |
| `app/my-campaigns/page.tsx`              | Không cần thay đổi                                  |
| `app/campaigns/[id]/edit/page.tsx`       | Không cần thay đổi                                  |

---

## Hằng số được sử dụng

```typescript
const SEPOLIA_CHAIN_ID = 11155111;
```

Hằng số này được sử dụng để kiểm tra xem ví hiện tại có kết nối với mạng Sepolia không.

---

## Testing

Hãy test các trường hợp:

1. ✅ Chưa cài MetaMask
2. ✅ Cài MetaMask nhưng chưa kết nối
3. ✅ Kết nối với mạng khác (không phải Sepolia)
4. ✅ Kết nối với Sepolia
5. ✅ Xem danh sách chiến dịch (read-only)
6. ✅ Cố gắng tạo chiến dịch (disable khi chưa kết nối)
7. ✅ Cố gắng tạo chiến dịch (disable khi mạng sai)
8. ✅ Tạo chiến dịch (thành công khi kết nối + mạng đúng)
9. ✅ Cố gắng quyên góp (disable khi chưa kết nối)
10. ✅ Cố gắng quyên góp (disable khi mạng sai)
