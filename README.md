# IE213 – Đồ án Gây quỹ & Cấp chứng chỉ

Hệ thống web tích hợp Ethereum: gây quỹ minh bạch và cấp chứng chỉ, đáp ứng yêu cầu đồ án môn IE213.

## Cấu trúc repository

```
├── backend/          # Node.js + Express API, MongoDB
├── frontend/         # Next.js (React) + Wagmi/Viem (ví & blockchain)
├── smart_contracts/  # Solidity + Hardhat (deploy Sepolia)
├── docs/             # Báo cáo, hướng dẫn demo, slide
├── README.md
└── .gitignore
```

## Yêu cầu môi trường

- Node.js 18+
- npm hoặc yarn
- Ví MetaMask (testnet Sepolia)
- (Tùy chọn) MongoDB Atlas cho backend

## Cài đặt & chạy

### 1. Smart contracts (Hardhat)

```bash
cd smart_contracts
npm install
cp .env.example .env   # Tạo .env, điền SEPOLIA_RPC_URL, PRIVATE_KEY (ví deploy), ETHERSCAN_API_KEY (nếu verify)
npm run compile
npm run test
npm run deploy:sepolia   # Deploy lên Sepolia
```

Sau khi deploy, ghi địa chỉ contract vào `.env` của frontend/backend: `NEXT_PUBLIC_FUNDRAISING_CONTRACT_ADDRESS=0x...`

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # MONGO_URI, PORT, ...
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_FUNDRAISING_CONTRACT_ADDRESS, NEXT_PUBLIC_CHAIN_ID=11155111 (Sepolia)
npm run dev
```

Truy cập http://localhost:3000. Kết nối ví MetaMask (mạng Sepolia), đọc dữ liệu từ contract và gửi giao dịch đóng góp.

## Mạng testnet & contract

- **Mạng:** Sepolia
- **Địa chỉ contract:** (cập nhật sau khi deploy, ghi trong báo cáo và README)

## Bảo mật

- Không lưu private key trên server hoặc trong code, không đưa lên GitHub.
- Dùng biến môi trường (.env) cho RPC URL, API key, địa chỉ contract.

## Tài liệu

Chi tiết báo cáo, hướng dẫn demo và slide đặt trong thư mục `docs/`.
