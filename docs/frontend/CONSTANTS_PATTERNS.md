# 🔧 Constants & Patterns - FundRaising DApp Implementation

## 📌 Hằng Số (Constants)

### Chain ID Sepolia

```typescript
const SEPOLIA_CHAIN_ID = 11155111;
```

**Sử dụng**: Kiểm tra xem ví có kết nối với Sepolia không
**Nơi sử dụng**:

- `app/page.tsx`
- `app/campaigns/page.tsx`
- `app/campaigns/create/page.tsx`
- `app/campaigns/[id]/page.tsx`
- `app/components/WalletConnectButton.tsx`

**Ví dụ**:

```typescript
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
```

---

## 🎨 Patterns & Conventions

### 1. Pattern: MetaMask Detection

```typescript
// State
const [hasProvider, setHasProvider] = useState<boolean | null>(null);

// Detect on mount
useEffect(() => {
    if (typeof window !== "undefined") {
        setHasProvider(Boolean((window as any).ethereum));
    }
}, []);

// Display
if (!hasProvider && hasProvider !== null) {
    // Show: "Chưa có MetaMask" + link cài đặt
}
```

**Nơi sử dụng**:

- `app/page.tsx`
- `app/components/WalletConnectButton.tsx`

---

### 2. Pattern: Network Validation

```typescript
// Import + Get chainId
import { useChainId } from "wagmi";
const chainId = useChainId();

// Check Sepolia
const SEPOLIA_CHAIN_ID = 11155111;
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

// Display warning if wrong
if (!isSepoliaNetwork) {
    // Show: "Sai mạn" + warning
}
```

**Nơi sử dụng**: Tất cả các trang

---

### 3. Pattern: Connection Check

```typescript
// Get connection status
import { useAccount } from 'wagmi';
const { isConnected } = useAccount();

// Display badge
{!isConnected && (
  <span className="text-amber-600 bg-amber-100">
    👁️ Chế độ xem (read-only)
  </span>
)}

// Disable features
{isConnected && isSepoliaNetwork ? (
  <Link href="/campaigns/create">Tạo mới</Link>
) : (
  <span className="text-slate-400 cursor-not-allowed">
    Tạo mới
  </span>
)}
```

**Nơi sử dụng**: Tất cả các trang

---

### 4. Pattern: Loading State

```typescript
// Get loading state
const { connect, isPending } = useConnect();

// Display during loading
<button disabled={isPending || !hasProvider}>
  {isPending ? 'Đang kết nối...' : 'Kết nối ví'}
</button>
```

**Nơi sử dụng**:

- `app/components/WalletConnectButton.tsx`

---

### 5. Pattern: Feature Protection

```typescript
// Check both conditions
const canDoAction = isConnected && isSepoliaNetwork;

// Enable/Disable button
{canDoAction ? (
  <button onClick={handleAction}>Action</button>
) : (
  <button disabled>Action</button>
)}

// Show reason in title
<button
  disabled={!canDoAction}
  title={!isConnected
    ? "Kết nối ví để sử dụng"
    : "Chuyển sang mạng Sepolia"}
>
  Action
</button>
```

**Nơi sử dụng**:

- CTA buttons
- Navigation menu
- Action buttons

---

### 6. Pattern: Error Message Display

```typescript
// Show different messages based on state
{!isConnected && (
  <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
    <p className="text-sm font-semibold text-blue-900">
      👁️ Chế độ xem (read-only)
    </p>
  </div>
)}

{isConnected && !isSepoliaNetwork && (
  <div className="rounded-lg border border-red-300 bg-red-50 p-4">
    <p className="text-sm font-semibold text-red-900">
      ⚠️ Mạn lưới sai
    </p>
  </div>
)}
```

**Nơi sử dụng**: Tất cả các trang

---

## 🎯 Color Scheme

### Màu sắc theo loại thông báo:

| Loại       | Màu                | Emoji    | Sử dụng                  |
| ---------- | ------------------ | -------- | ------------------------ |
| Thông tin  | 🔵 Xanh (blue)     | ℹ️ 🔐 👁️ | Read-only, cần kết nối   |
| Cảnh báo   | 🟡 Vàng (amber)    | ⚠️ 💡    | MetaMask chưa cài        |
| Lỗi        | 🔴 Đỏ (red)        | ⚠️ ❌    | Sai mạn, không đủ gas    |
| Thành công | 🟢 Xanh lá (green) | ✓ ✅     | Kết nối OK, giao dịch OK |

### CSS Classes:

- **Blue**: `border-blue-300 bg-blue-50 text-blue-900`
- **Amber**: `border-amber-300 bg-amber-50 text-amber-900`
- **Red**: `border-red-300 bg-red-50 text-red-900`
- **Green**: `border-green-300 bg-green-50 text-green-900`

---

## 🔗 External Links

### MetaMask Download

```
https://metamask.io/download/
```

**Hiển thị khi**: Chưa cài MetaMask
**Text**: "Cài đặt MetaMask"

### Network Guide

```
https://chainlist.org/?search=sepolia
```

**Hiển thị khi**: Mạn sai (không phải Sepolia)
**Text**: "Hướng dẫn đổi mạn" hoặc "Hướng dẫn chuyển mạn"

### Sepolia Faucet

```
https://faucet.sepolia.dev
```

**Sử dụng**: Lấy ETH thử nghiệm

### Sepolia Etherscan

```
https://sepolia.etherscan.io
```

**Sử dụng**: Xem transactions, addresses

---

## 📋 Thông Báo (Messages)

### Tiếng Việt (Toàn bộ tiếng Việt)

#### MetaMask

- **Chưa cài**: "⚠️ Chưa có MetaMask"
- **Gợi ý**: "Vui lòng cài đặt MetaMask để kết nối ví"
- **Link**: "Cài đặt MetaMask"

#### Read-Only

- **Badge**: "👁️ Chế độ xem (read-only)"
- **Thông báo**: "Bạn đang xem dữ liệu ở chế độ read-only"
- **Gợi ý**: "Vui lòng kết nối ví để tạo chiến dịch"

#### Mạn Sai

- **Badge**: "⚠️ Sai mạn"
- **Tiêu đề**: "Sai mạn lưới"
- **Thông báo**: "Vui lòng chuyển sang mạn Sepolia"
- **Yêu cầu**: "Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)"

#### Kết Nối OK

- **Badge**: "✓ Kết nối Sepolia"
- **Thông báo**: "✓ Kết nối Sepolia thành công"
- **Gợi ý**: "Ví của bạn đã kết nối với mạn Sepolia"

#### Action

- **Disabled button**: "Kết nối ví để tạo chiến dịch"
- **Wrong network**: "Sai mạn"
- **Success**: "✓ Giao dịch thành công!"
- **Pending**: "⏳ Đợi xác nhận từ ví..."
- **Confirming**: "🔄 Đang xác nhận..."

---

## 🔄 Conditional Logic Patterns

### 1. Three-State Display

```typescript
// Condition 1: Not connected
if (!isConnected) {
  return <ReadOnlyComponent />;
}

// Condition 2: Connected but wrong network
if (!isSepoliaNetwork) {
  return <WrongNetworkComponent />;
}

// Condition 3: Connected & correct network
return <FullFeatureComponent />;
```

### 2. Conditional Rendering

```typescript
// Method 1: Ternary
{isConnected && isSepoliaNetwork ? (
  <EnabledComponent />
) : (
  <DisabledComponent />
)}

// Method 2: If statement
if (isConnected && isSepoliaNetwork) {
  return <Page />;
}
return <ProtectPage />;

// Method 3: Logical &&
{isConnected && <ConnectedBadge />}
```

### 3. Disabled Attribute

```typescript
// Based on condition
<button
  disabled={!isConnected || !isSepoliaNetwork}
>
  Action
</button>

// With title tooltip
<button
  disabled={!canDoAction}
  title={!isConnected
    ? "Kết nối ví để sử dụng"
    : !isSepoliaNetwork
    ? "Chuyển sang mạn Sepolia"
    : ""
  }
>
  Action
</button>
```

---

## 🎓 Best Practices

### ✅ DO

- ✅ Check MetaMask existence trước khi yêu cầu kết nối
- ✅ Sử dụng `useChainId()` thay vì `chain?.id`
- ✅ Hiển thị badge trạng thái kết nối
- ✅ Disable nút thay vì ẩn
- ✅ Cung cấp link hướng dẫn
- ✅ Sử dụng tiếng Việt cho tất cả thông báo
- ✅ Sử dụng emoji để dễ nhận diện
- ✅ Check cả isConnected AND isSepoliaNetwork

### ❌ DON'T

- ❌ Yêu cầu kết nối ngay mà không kiểm tra MetaMask
- ❌ Sử dụng `chain?.id` (có thể undefined)
- ❌ Ẩn nút thay vì disable (confusing)
- ❌ Hiển thị thông báo bằng tiếng Anh
- ❌ Quên kiểm tra network
- ❌ Hardcode chain ID (sử dụng constant)
- ❌ Hiển thị lỗi technical (giải thích cho user)

---

## 🧪 Testing Constants

### Test Case IDs

- **TC1-3**: MetaMask scenarios
- **TC4**: Network scenarios
- **TC5-8**: View/Create pages
- **TC9-12**: Donation scenarios
- **TC13-17**: My campaigns & details

### Test Data

- **Valid Network**: Chain ID 11155111 (Sepolia)
- **Valid Amount**: 0.01 ETH, 0.05 ETH, 0.1 ETH
- **Max Amount**: 1000 ETH
- **Deadline**: Tương lai (1 năm tối đa)

---

## 🔗 Reference Links

| Resource   | URL                          |
| ---------- | ---------------------------- |
| MetaMask   | https://metamask.io          |
| Sepolia    | https://sepolia.etherscan.io |
| Chainlist  | https://chainlist.org        |
| Faucet     | https://faucet.sepolia.dev   |
| Wagmi Docs | https://wagmi.sh             |
| viem Docs  | https://viem.sh              |

---

## 📝 Summary

- **1 constant**: `SEPOLIA_CHAIN_ID = 11155111`
- **6 main patterns**: Detection, validation, check, loading, protection, error
- **3 hook chính**: `useAccount()`, `useChainId()`, `useConnect()`
- **4 states chính**: Not connected, wrong network, connected OK, loading
- **100% tiếng Việt**: Tất cả thông báo
- **Color-coded**: Blue/Amber/Red/Green
- **User-friendly**: Disable thay vì crash

**Mỗi pattern đều reusable, consistent, và easy to maintain!** ✨
