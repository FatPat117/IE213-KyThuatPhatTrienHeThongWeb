# Hệ Thống Gây Quỹ Xây Trường Học (Community Funding Platform)

## Giới thiệu

Hệ thống gây quỹ cộng đồng cho phép người dùng:

- Tạo chiến dịch gây quỹ (campaign)
- Quyên góp (donate) bằng ví blockchain
- Nhận chứng nhận NFT khi quyên góp thành công
- Rút tiền khi chiến dịch thành công
- Nhận hoàn tiền khi chiến dịch thất bại

**Hệ thống gồm các thành phần:**

- **Frontend:** Giao diện người dùng (Next.js)
- **Backend:** Các dịch vụ microservice (Node.js, MongoDB)
- **Smart Contract:** Triển khai trên Ethereum Sepolia Testnet
- **Caddy:** Reverse proxy
- **Docker Compose:** Quản lý và khởi động toàn bộ hệ thống

---

## Yêu cầu hệ thống

- Docker & Docker Compose
- Node.js >= 18.x
- Yarn hoặc npm
- Trình duyệt web hiện đại
- (Tuỳ chọn) Ví MetaMask để kết nối blockchain

---

## Hướng dẫn cài đặt & khởi động

### 1. Clone source code

```bash
git clone <link-repo>
cd IE213-KyThuatPhatTrienHeThongWeb
```

### 2. Cấu hình biến môi trường

Tạo file `.env` cho từng service nếu cần (tham khảo `.env.example` trong từng thư mục).

### 3. Khởi động hệ thống bằng Docker Compose

```bash
docker compose up -d --build
```

- Lệnh này sẽ tự động build và chạy toàn bộ các service: frontend, backend, database, caddy, v.v.

### 4. Truy cập hệ thống

- Giao diện web: [http://localhost](http://localhost)
- Swagger API docs: [http://localhost/api/docs](http://localhost/api/docs) (nếu có)
- Các service backend lắng nghe ở các port riêng (xem docker-compose.yml)

---

## Mạng Blockchain sử dụng

- **Testnet:** Ethereum Sepolia
- **Địa chỉ smart contract:** `0x543c9F923CaCEAf5d2799b0dc84e9d8E440Df6F9`
- **Source code:** thư mục `smart-contracts/`

---

## Cấu trúc thư mục

```
├── backend/                # Các microservice Node.js (auth, user, campaign, donation, ...)
├── frontend/               # Giao diện người dùng Next.js
├── smart-contracts/        # Source code smart contract (Solidity)
├── caddy/                  # Cấu hình reverse proxy
├── docker-compose.yml      # File cấu hình Docker Compose
└── README.md               # Tài liệu hướng dẫn
```

---

## Hướng dẫn demo sử dụng hệ thống

### 1. Đăng nhập bằng ví MetaMask

- Truy cập [http://localhost](http://localhost)
- Nhấn “Đăng nhập” và kết nối ví MetaMask (chọn mạng Sepolia Testnet)
- Hệ thống sẽ xác thực ví và tạo tài khoản nếu lần đầu đăng nhập

### 2. Tạo chiến dịch gây quỹ

- Chọn “Tạo chiến dịch”
- Nhập thông tin: tên, mô tả, mục tiêu, thời gian, milestone...
- Xác nhận giao dịch trên MetaMask (tạo campaign on-chain)
- Sau khi thành công, chiến dịch sẽ xuất hiện trên trang chủ

### 3. Quyên góp vào chiến dịch

- Chọn một chiến dịch đang hoạt động
- Nhấn “Quyên góp”, nhập số tiền muốn ủng hộ
- Xác nhận giao dịch trên MetaMask (donate on-chain)
- Sau khi thành công, số tiền sẽ được cập nhật realtime

### 4. Nhận chứng nhận NFT

- Sau khi quyên góp, hệ thống sẽ tự động mint NFT chứng nhận cho ví của bạn
- Vào trang “Chứng nhận” để xem danh sách NFT đã nhận
- Có thể kiểm tra NFT trên Sepolia Testnet qua các explorer (ví dụ: sepolia.etherscan.io)

### 5. Rút tiền/Hoàn tiền

- Chủ chiến dịch có thể rút tiền khi chiến dịch đạt mục tiêu
- Nếu chiến dịch thất bại, người quyên góp có thể yêu cầu hoàn tiền (refund)
- Các thao tác này đều xác nhận qua MetaMask và ghi nhận on-chain

### 6. Kiểm thử nhanh (demo test)

- Có thể dùng nhiều tài khoản ví (MetaMask) để tạo, donate, kiểm tra các flow trên
- Xem log giao dịch trên MetaMask hoặc Sepolia explorer
- Đảm bảo luôn chọn đúng mạng Sepolia Testnet khi thao tác

1. **Đăng nhập bằng ví MetaMask**
   Người dùng đăng nhập bằng ví blockchain để xác thực.

2. **Tạo chiến dịch gây quỹ**
   Chọn “Tạo chiến dịch”, nhập thông tin, xác nhận giao dịch trên blockchain.

3. **Quyên góp**
   Chọn chiến dịch, nhập số tiền, xác nhận giao dịch trên blockchain.

4. **Nhận chứng nhận NFT**
   Sau khi quyên góp thành công, người dùng nhận NFT chứng nhận.

5. **Rút tiền/Hoàn tiền**
    - Chủ chiến dịch rút tiền khi chiến dịch thành công.
    - Người quyên góp nhận hoàn tiền nếu chiến dịch thất bại.

---

## Phát triển & kiểm thử

### Chạy riêng từng service (nếu không dùng Docker)

**Backend:**

```bash
cd backend/<service-name>
yarn install
yarn dev
```

**Frontend:**

```bash
cd frontend
yarn install
yarn dev
```

**Smart contract:**

```bash
cd smart-contracts
forge test -vv
```

---

## Đóng góp & liên hệ

- Báo lỗi hoặc góp ý: Tạo issue trên GitHub hoặc liên hệ nhóm phát triển.

---
