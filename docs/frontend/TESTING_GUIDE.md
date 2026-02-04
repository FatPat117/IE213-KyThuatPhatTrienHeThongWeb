# Hướng dẫn Kiểm tra User Flow - FundRaising DApp

## Chuẩn bị

1. **Cài đặt MetaMask**: https://metamask.io/download/
2. **Cấu hình Sepolia**:
    - Mở MetaMask
    - Vào "Settings" > "Networks"
    - Thêm Sepolia (hoặc dùng built-in)
    - Chain ID: `11155111`
3. **Lấy ETH test**: https://faucet.sepolia.dev
4. **Chạy ứng dụng**: `npm run dev`

---

## Kiểm tra từng User Flow

### 1. Chưa cài MetaMask

**Bước thực hiện:**

1. Tắt MetaMask hoặc sử dụng trình duyệt khác không có MetaMask
2. Truy cập http://localhost:3000

**Kết quả mong đợi:**

- [ ] Hiển thị badge "👁️ Chế độ xem (read-only)"
- [ ] Nút "Kết nối ví" disabled
- [ ] Có hộp thông báo vàng "⚠️ Chưa có MetaMask"
- [ ] Có link "Cài đặt MetaMask"
- [ ] Có thể xem danh sách chiến dịch (read-only)
- [ ] Nút "Bắt đầu chiến dịch" disabled
- [ ] Nút "Tạo mới" trong menu bị dim

---

### 2. Cài MetaMask nhưng chưa kết nối

**Bước thực hiện:**

1. Bật MetaMask nhưng không kết nối ứng dụng
2. Truy cập http://localhost:3000
3. Quan sát nút "Kết nối ví"

**Kết quả mong đợi:**

- [ ] Hiển thị badge "👁️ Chế độ xem (read-only)"
- [ ] Nút "Kết nối ví" enabled (màu xanh)
- [ ] Thông báo: "Chưa kết nối ví? Bạn vẫn có thể duyệt chiến dịch ở chế độ xem."
- [ ] Nút "Bắt đầu chiến dịch" disabled
- [ ] Có thể xem danh sách chiến dịch

---

### 3. Kết nối MetaMask nhưng mạng sai (không phải Sepolia)

**Bước thực hiện:**

1. Mở MetaMask
2. Chuyển sang một mạng khác (ví dụ: Mainnet, Polygon, vv.)
3. Nhấn "Kết nối ví" trên trang chủ
4. Chấp nhận yêu cầu kết nối trong MetaMask
5. Quan sát trang chủ

**Kết quả mong đợi:**

- [ ] Hiển thị badge "⚠️ Sai mạng"
- [ ] Hộp cảnh báo đỏ: "⚠️ Mạn lưới sai - Vui lòng chuyển sang Sepolia"
- [ ] Nút "Bắt đầu chiến dịch" disabled
- [ ] Component WalletConnectButton hiển thị:
    - Địa chỉ ví rút gọn
    - Cảnh báo "⚠️ Sai mạng"
    - Nút "Hướng dẫn chuyển mạng"
    - Nút "Ngắt kết nối"
- [ ] Menu có các nút bị dim (Tạo mới, Quyên góp của tôi, Chiến dịch của tôi)

---

### 4. Kết nối MetaMask với Sepolia (Chế độ toàn quyền)

**Bước thực hiện:**

1. Mở MetaMask
2. Chuyển sang mạng Sepolia
3. Nhấn "Kết nối ví" trên trang chủ
4. Chấp nhận yêu cầu kết nối
5. Quan sát trang chủ

**Kết quả mong đợi:**

- [ ] Hiển thị badge "✓ Kết nối Sepolia"
- [ ] Hộp xanh lá: "✓ Kết nối thành công - Ví của bạn đã kết nối với mạng Sepolia"
- [ ] Component WalletConnectButton hiển thị:
    - Địa chỉ ví rút gọn
    - Thông báo "✓ Kết nối Sepolia thành công"
    - Nút "Ngắt kết nối"
- [ ] Nút "Bắt đầu chiến dịch" enabled (màu xanh)
- [ ] Menu hiển thị đầy đủ:
    - "Chiến dịch" (có thể click)
    - "Tạo mới" (có thể click)
    - "Quyên góp của tôi" (có thể click)
    - "Chiến dịch của tôi" (có thể click)
- [ ] Có thể nhấn vào "Bắt đầu chiến dịch" mà không bị block

---

### 5. Xem Danh Sách Chiến Dịch - Chế độ Read-Only

**Bước thực hiện:**

1. Chưa kết nối ví hoặc kết nối với mạng khác
2. Truy cập http://localhost:3000/campaigns

**Kết quả mong đợi:**

- [ ] Hiển thị banner xanh ở trên cùng: "👁️ Chế độ xem (read-only)"
- [ ] Nút "Tạo chiến dịch" disabled (màu xám, không click được)
- [ ] Nút "🔄 Tải lại" enabled
- [ ] Có thể xem danh sách chiến dịch
- [ ] Có thể tìm kiếm chiến dịch
- [ ] Có thể lọc và sắp xếp chiến dịch

---

### 6. Tạo Chiến Dịch - Chưa Kết Nối

**Bước thực hiện:**

1. Chưa kết nối ví
2. Truy cập http://localhost:3000/campaigns/create

**Kết quả mong đợi:**

- [ ] Trang hiển thị hộp:
    - Icon "🔐"
    - Tiêu đề: "Cần kết nối ví"
    - Mô tả: "Vui lòng kết nối ví để tạo chiến dịch trên blockchain."
- [ ] Hộp gợi ý xanh: "💡 Lưu ý: Cần MetaMask hoặc ví Web3..."
- [ ] Nút "← Về danh sách chiến dịch"
- [ ] Không có form tạo chiến dịch

---

### 7. Tạo Chiến Dịch - Mạng Sai

**Bước thực hiện:**

1. Kết nối ví với mạng khác (không phải Sepolia)
2. Truy cập http://localhost:3000/campaigns/create

**Kết quả mong đợi:**

- [ ] Trang hiển thị hộp:
    - Icon "⚠️"
    - Tiêu đề: "Sai mạng"
    - Mô tả: "Vui lòng chuyển sang mạn Sepolia để tạo chiến dịch."
- [ ] Hộp cảnh báo đỏ: "Yêu cầu: Ethereum Sepolia (Chain ID: 11155111)"
- [ ] Nút "Hướng dẫn đổi mạng" (mở chainlist.org)
- [ ] Nút "← Về danh sách chiến dịch"
- [ ] Không có form tạo chiến dịch

---

### 8. Tạo Chiến Dịch - Thành Công (Sepolia)

**Bước thực hiện:**

1. Kết nối ví với Sepolia
2. Truy cập http://localhost:3000/campaigns/create
3. Điền form:
    - Tên chiến dịch: "Test Campaign"
    - Mô tả: "Test description"
    - Mục tiêu: 0.1 ETH
    - Thời hạn: Chọn ngày trong tương lai
4. Nhấn "Tạo chiến dịch"
5. Chấp nhận transaction trong MetaMask

**Kết quả mong đợi:**

- [ ] Hiển thị form đầy đủ
- [ ] Nút "Tạo chiến dịch" enabled
- [ ] MetaMask popup hiển thị
- [ ] Sau khi chấp nhận, có message "🔄 Đang xác nhận..."
- [ ] Sau khi confirm, có message "✓ Chiến dịch tạo thành công!"
- [ ] Redirect sang trang chi tiết chiến dịch

---

### 9. Xem Chi Tiết Chiến Dịch - Chế độ Read-Only

**Bước thực hiện:**

1. Chưa kết nối ví
2. Truy cập chi tiết chiến dịch (ví dụ: http://localhost:3000/campaigns/1)

**Kết quả mong đợi:**

- [ ] Hiển thị thông tin chiến dịch (read-only)
- [ ] Widget "Ủng hộ chiến dịch" hiển thị thông báo:
    - "🔐 Vui lòng kết nối ví để quyên góp..."
- [ ] Nút "Quyên góp" disabled
- [ ] Input số tiền disabled
- [ ] Nút "Quick amount" disabled
- [ ] Có thể xem danh sách quyên góp (read-only)

---

### 10. Quyên Góp - Chưa Kết Nối

**Bước thực hiện:**

1. Xem chi tiết chiến dịch khi chưa kết nối ví
2. Quan sát widget "Ủng hộ chiến dịch"

**Kết quả mong đợi:**

- [ ] Thông báo xanh: "🔐 Vui lòng kết nối ví để quyên góp..."
- [ ] Input số tiền disabled
- [ ] Nút "Quyên góp" disabled, text: "Kết nối ví để quyên góp"

---

### 11. Quyên Góp - Mạng Sai

**Bước thực hiện:**

1. Kết nối ví với mạn khác (không phải Sepolia)
2. Xem chi tiết chiến dịch

**Kết quả mong đợi:**

- [ ] Thông báo vàng: "⚠️ Sai mạng. Vui lòng chuyển sang Sepolia để quyên góp."
- [ ] Có link "Hướng dẫn đổi mạng"
- [ ] Nút "Quyên góp" disabled, text: "Sai mạng"

---

### 12. Quyên Góp - Thành Công (Sepolia)

**Bước thực hiện:**

1. Kết nối ví với Sepolia
2. Xem chi tiết chiến dịch
3. Nhập số tiền (ví dụ: 0.01)
4. Nhấn "💝 Quyên góp"
5. Chấp nhận transaction trong MetaMask

**Kết quả mong đợi:**

- [ ] Không có thông báo cảnh báo
- [ ] Nút "Quyên góp" enabled (màu trắng trên nền xanh)
- [ ] Input số tiền enabled
- [ ] Nút "Quick amount" enabled
- [ ] MetaMask popup hiển thị
- [ ] Sau khi chấp nhận, text thay đổi: "⏳ Đợi xác nhận từ ví..."
- [ ] Sau khi confirm: "🔄 Đang xác nhận..."
- [ ] Sau khi thành công: "✓ Quyên góp thành công! Cảm ơn bạn."
- [ ] Hiển thị link "Xem trên Sepolia Etherscan"

---

### 13. Xem Lịch Sử Quyên Góp - Chưa Kết Nối

**Bước thực hiện:**

1. Chưa kết nối ví
2. Truy cập http://localhost:3000/donations

**Kết quả mong đợi:**

- [ ] Hiển thị hộp:
    - Icon "🔐"
    - Tiêu đề: "Cần kết nối ví"
    - Mô tả: "Vui lòng kết nối ví để xem lịch sử quyên góp của bạn."
- [ ] Hộp gợi ý xanh: "💡 Lưu ý: Lịch sử quyên góp sẽ được lấy từ blockchain Sepolia."
- [ ] Nút "← Về danh sách chiến dịch"

---

### 14. Xem Lịch Sử Quyên Góp - Mạn Sai

**Bước thực hiện:**

1. Kết nối ví với mạn khác
2. Truy cập http://localhost:3000/donations

**Kết quả mong đợi:**

- [ ] Hiển thị hộp:
    - Icon "⚠️"
    - Tiêu đề: "Sai mạn lưới"
    - Mô tả: "Vui lòng chuyển sang mạn Sepolia để xem lịch sử quyên góp."
- [ ] Nút "Hướng dẫn chuyển mạn"
- [ ] Nút "← Về chiến dịch"

---

### 15. Xem Chiến Dịch Của Tôi - Chưa Kết Nối

**Bước thực hiện:**

1. Chưa kết nối ví
2. Truy cập http://localhost:3000/my-campaigns

**Kết quả mong đợi:**

- [ ] Hiển thị thông báo: "Chưa kết nối ví - Vui lòng kết nối ví để xem chiến dịch của bạn"
- [ ] Nút "Về trang chủ"

---

### 16. Xem Chiến Dịch Của Tôi - Mạn Sai

**Bước thực hiện:**

1. Kết nối ví với mạn khác
2. Truy cập http://localhost:3000/my-campaigns

**Kết quả mong đợi:**

- [ ] Hiển thị thông báo: "Sai mạn - Vui lòng chuyển sang Sepolia để xem chiến dịch."
- [ ] Nút "Hướng dẫn đổi mạn"
- [ ] Nút "← Về danh sách chiến dịch"

---

### 17. Xem Chiến Dịch Của Tôi - Sepolia

**Bước thực hiện:**

1. Kết nối ví với Sepolia
2. Tạo vài chiến dịch (hoặc xem chiến dịch cũ của bạn)
3. Truy cập http://localhost:3000/my-campaigns

**Kết quả mong đợi:**

- [ ] Hiển thị danh sách chiến dịch của bạn
- [ ] Mỗi chiến dịch hiển thị:
    - Tên chiến dịch
    - Mô tả
    - Số tiền mục tiêu
    - Số tiền đã gây quỹ
    - Progress bar
    - Nút "Xem chi tiết"

---

## Checklist Toàn Bộ

### Trang Chủ

- [ ] Hiển thị badge MetaMask/Network
- [ ] Thông báo MetaMask (nếu chưa cài)
- [ ] Menu đầy đủ khi kết nối Sepolia
- [ ] CTA buttons bảo vệ

### Trang Danh Sách Chiến Dịch

- [ ] Status banner read-only/mạn sai
- [ ] Nút tạo chiến dịch bảo vệ
- [ ] Có thể xem danh sách (read-only)

### Trang Tạo Chiến Dịch

- [ ] Kiểm tra kết nối ví
- [ ] Kiểm tra mạn Sepolia
- [ ] Form tạo chiến dịch (nếu pass)

### Trang Chi Tiết Chiến Dịch

- [ ] Thông báo read-only/mạn sai
- [ ] Nút quyên góp bảo vệ
- [ ] Có thể xem chi tiết (read-only)

### Component WalletConnectButton

- [ ] Thông báo MetaMask
- [ ] Thông báo mạn sai
- [ ] Hiển thị địa chỉ ví
- [ ] Nút ngắt kết nối

### Trang Lịch Sử Quyên Góp

- [ ] Kiểm tra kết nối ví
- [ ] Kiểm tra mạn Sepolia
- [ ] Hiển thị lịch sử (nếu pass)

### Trang Chiến Dịch Của Tôi

- [ ] Kiểm tra kết nối ví
- [ ] Kiểm tra mạn Sepolia
- [ ] Hiển thị danh sách (nếu pass)

---

## Lưu Ý

- Tất cả thông báo bằng **tiếng Việt**
- Sử dụng **Sepolia testnet** (Chain ID: 11155111)
- Có thể lấy **ETH thử nghiệm** từ: https://faucet.sepolia.dev
- Link **chainlist.org** để hướng dẫn chuyển mạn
- Tất cả transactions đều trên **blockchain Sepolia**
