# User Flow Implementation - FundRaising DApp

## Tổng Quan

Tất cả các trang đã được cập nhật để tuân theo user flow đầu tiên: **Luồng Trang Chủ (Home / Landing Page)**. Hệ thống hiện hỗ trợ:

1. ✅ Kiểm tra sự tồn tại của `window.ethereum` (MetaMask)
2. ✅ Hiển thị thông báo rõ ràng khi chưa có MetaMask
3. ✅ Chế độ xem dữ liệu (read-only) cho người dùng không kết nối ví
4. ✅ Kiểm tra kết nối ví và mạng blockchain (Sepolia)
5. ✅ Yêu cầu chuyển mạng nếu sai (không phải Sepolia)
6. ✅ Bảo vệ các chức năng yêu cầu kết nối ví (tạo chiến dịch, quyên góp)
7. ✅ Hiển thị địa chỉ ví rút gọn sau khi kết nối thành công

---

## Trang Chủ (Home) - `app/page.tsx`

### Thay đổi chính:

- **Kiểm tra MetaMask**: Kiểm tra `window.ethereum` khi component mount
- **Hiển thị trạng thái**: Badge hiển thị trạng thái kết nối (read-only, sai mạng, kết nối thành công)
- **Thông báo MetaMask**: Hiển thị hộp thông báo với link cài đặt nếu chưa có MetaMask
- **Thông báo mạng sai**: Hiển thị cảnh báo nếu ví đã kết nối nhưng mạng sai
- **Menu điều hướng**: Kích hoạt menu đầy đủ chỉ khi `isConnected && isSepoliaNetwork`
- **CTA buttons**: Disable nút "Bắt đầu chiến dịch" nếu không kết nối hoặc mạng sai

### Điều kiện:

```typescript
const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID; // 11155111

// Kiểm tra kết nối đầy đủ
const canCreateCampaign = isConnected && isSepoliaNetwork;
```

---

## Trang Danh Sách Chiến Dịch - `app/campaigns/page.tsx`

### Thay đổi chính:

- **Thêm kiểm tra kết nối**: Hiển thị banner thông báo ở đầu trang khi:
    - Chưa kết nối ví: "Chế độ xem (read-only)"
    - Mạng sai: "Mạng lưới sai - Vui lòng chuyển sang Sepolia"
- **Nút tạo chiến dịch được bảo vệ**: Disable nếu không kết nối hoặc mạng sai
- **Mọi người đều có thể xem danh sách**: Dữ liệu hiển thị ở chế độ read-only

### Điều kiện:

```typescript
const canCreateCampaign = isConnected && isSepoliaNetwork;

// Nút tạo chiến dịch
{canCreateCampaign ? (
  <Link href="/campaigns/create">+ Tạo chiến dịch</Link>
) : (
  <button disabled>+ Tạo chiến dịch</button>
)}
```

---

## Trang Tạo Chiến Dịch - `app/campaigns/create/page.tsx`

### Thay đổi chính:

- **Kiểm tra kết nối ví**: Nếu chưa kết nối, hiển thị trang thông báo:
    ```
    🔐 Cần kết nối ví
    Vui lòng kết nối ví để tạo chiến dịch trên blockchain.
    ```
- **Kiểm tra mạng**: Nếu mạng sai (không phải Sepolia), hiển thị:
    ```
    ⚠️ Sai mạng
    Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch.
    ```
- **Sử dụng constant**: Thay vì hardcode `11155111`, sử dụng `SEPOLIA_CHAIN_ID`

### Logic kiểm tra:

```typescript
const SEPOLIA_CHAIN_ID = 11155111;

if (!isConnected) {
    // Hiển thị: Cần kết nối ví
}

if (!isSepoliaNetwork) {
    // Hiển thị: Sai mạng
}

// Nếu cả hai kiểm tra pass, hiển thị form tạo chiến dịch
```

---

## Trang Chi Tiết Chiến Dịch - `app/campaigns/[id]/page.tsx`

### Thay đổi chính:

- **Thông báo read-only**: Nếu chưa kết nối, hiển thị thông báo:
    ```
    🔐 Vui lòng kết nối ví để quyên góp. Bạn vẫn có thể xem dữ liệu ở chế độ read-only.
    ```
- **Thông báo mạng sai**: Nếu mạng sai:
    ```
    ⚠️ Sai mạng. Vui lòng chuyển sang Sepolia để quyên góp.
    ```
- **Disable nút Quyên góp**: Nếu `!canDonate` (chưa kết nối hoặc mạng sai)
- **Dữ liệu chiến dịch**: Hiển thị cho tất cả người dùng (read-only)

### Điều kiện:

```typescript
const canDonate = Boolean(
    isConnected && isSepolia && campaign && !campaign.completed,
);
```

---

## Trang Lịch Sử Quyên Góp - `app/donations/page.tsx`

### Thay đổi chính:

- **Kiểm tra kết nối**: Nếu chưa kết nối, hiển thị:
    ```
    🔐 Cần kết nối ví
    Vui lòng kết nối ví để xem lịch sử quyên góp của bạn.
    ```
- **Kiểm tra mạng**: Nếu mạng sai, hiển thị:
    ```
    ⚠️ Sai mạng lưới
    Vui lòng chuyển sang mạng Sepolia để xem lịch sử quyên góp.
    ```
- **Thông báo gợi ý**: Thêm hint về blockchain Sepolia

---

## Trang Chiến Dịch Của Tôi - `app/my-campaigns/page.tsx`

### Thay đổi chính:

- **Kiểm tra kết nối**: Hiển thị thông báo nếu chưa kết nối
- **Kiểm tra mạng**: Hiển thị thông báo nếu mạng sai
- **Danh sách riêng**: Chỉ hiển thị các chiến dịch được tạo bởi ví hiện tại

---

## Component WalletConnectButton - `app/components/WalletConnectButton.tsx`

### Cải thiện chính:

- **Kiểm tra MetaMask**: Hiển thị hộp thông báo nếu chưa cài MetaMask
- **Trạng thái kết nối**: Hiển thị 3 trạng thái khác nhau:
    1. **Chưa cài MetaMask**: Hộp amber với link cài đặt
    2. **Chưa kết nối**: Nút "Kết nối ví" và thông báo read-only
    3. **Đã kết nối**: Hiển thị địa chỉ ví, kiểm tra mạng, nút ngắt kết nối

### Tính năng:

- ✅ Hiển thị địa chỉ ví rút gọn (6 ký tự đầu + 4 ký tự cuối)
- ✅ Cảnh báo nếu mạng sai với link hướng dẫn chuyển mạng
- ✅ Xử lý lỗi kết nối rõ ràng
- ✅ Trạng thái loading khi đang kết nối (`isPending`)

---

## Hằng số được sử dụng

### SEPOLIA_CHAIN_ID

```typescript
const SEPOLIA_CHAIN_ID = 11155111;
```

Được định nghĩa ở các trang để kiểm tra mạng blockchain:

- `app/page.tsx`
- `app/campaigns/page.tsx`
- `app/campaigns/create/page.tsx`
- `app/components/WalletConnectButton.tsx`
- và các trang khác

---

## Luồng Người Dùng - Tóm Tắt

### Trường hợp 1: Chưa cài MetaMask

1. Người dùng truy cập trang chủ
2. Hệ thống kiểm tra `window.ethereum`
3. Hiển thị thông báo "Chưa có MetaMask" với link cài đặt
4. Người dùng vẫn có thể xem dữ liệu ở chế độ read-only
5. Các chức năng yêu cầu kết nối bị disable

### Trường hợp 2: Đã cài MetaMask nhưng chưa kết nối

1. Người dùng truy cập trang chủ
2. Hệ thống kiểm tra `isConnected`
3. Hiển thị badge "Chế độ xem (read-only)"
4. Hiển thị nút "Kết nối ví"
5. Người dùng nhấn nút, MetaMask popup hiện
6. Sau khi chấp nhận, hệ thống lấy địa chỉ ví

### Trường hợp 3: Đã kết nối nhưng mạng sai

1. Người dùng kết nối ví thành công
2. Hệ thống kiểm tra `chainId`
3. Nếu `chainId !== SEPOLIA_CHAIN_ID`:
    - Hiển thị badge "Sai mạng"
    - Hiển thị cảnh báo đỏ
    - Disable các chức năng
    - Hiển thị link hướng dẫn chuyển mạng

### Trường hợp 4: Kết nối thành công với mạng Sepolia

1. Người dùng kết nối ví và chuyển sang Sepolia
2. Hệ thống kiểm tra `isConnected && isSepoliaNetwork`
3. Hiển thị:
    - Badge "Kết nối Sepolia"
    - Địa chỉ ví rút gọn
    - Menu điều hướng đầy đủ
    - Tất cả chức năng bị mở khóa

---

## Testing Checklist

- [ ] Truy cập trang chủ không cài MetaMask
- [ ] Truy cập trang chủ chưa kết nối ví
- [ ] Kết nối ví với mạng khác (không phải Sepolia)
- [ ] Kết nối ví với mạng Sepolia
- [ ] Xem danh sách chiến dịch (read-only)
- [ ] Cố gắng tạo chiến dịch (chưa kết nối) - phải bị disable
- [ ] Cố gắng tạo chiến dịch (mạng sai) - phải bị disable
- [ ] Tạo chiến dịch (đã kết nối + mạng đúng) - phải thành công
- [ ] Xem chi tiết chiến dịch (read-only)
- [ ] Cố gắng quyên góp (chưa kết nối) - phải hiển thị thông báo
- [ ] Cố gắng quyên góp (mạng sai) - phải hiển thị cảnh báo
- [ ] Quyên góp (đã kết nối + mạng đúng) - phải thành công
- [ ] Xem lịch sử quyên góp (chưa kết nối) - phải hiển thị thông báo
- [ ] Xem chiến dịch của tôi (chưa kết nối) - phải hiển thị thông báo

---

## Ghi chú

- Tất cả các thông báo đều bằng tiếng Việt
- Các nút action được disable trực quan (opacity giảm, cursor not-allowed)
- Có link hướng dẫn chuyển mạng (chainlist.org)
- Kiểm tra mạng luôn được thực hiện trước khi cho phép action
- Người dùng không kết nối ví vẫn có thể xem dữ liệu on-chain ở chế độ read-only
