# IE213 – Hệ Thống Gây Quỹ Minh Bạch trên Blockchain

**Đồ án môn Kỹ Thuật Phát Triển Hệ Thống Web (IE213)**

Hệ thống web3 hoàn chỉnh cho các chiến dịch gây quỹ minh bạch trên blockchain Ethereum, tích hợp smart contract, đọc/ghi dữ liệu on-chain, và xử lý giao dịch blockchain.

---

## ✨ Tính Năng Chính

### 🎯 Quản Lý Chiến Dịch

- ✅ **Tạo chiến dịch** - Thiết lập mục tiêu quyên góp, thời hạn trên blockchain
- ✅ **Chỉnh sửa chiến dịch** - Cập nhật tiêu đề và mô tả khi chiến dịch đang hoạt động
- ✅ **Xem danh sách** - Duyệt tất cả chiến dịch với tìm kiếm/lọc/sắp xếp
- ✅ **Chi tiết chiến dịch** - Xem thông tin, tiến độ, quyên góp của chiến dịch

### 💝 Quản Lý Quyên Góp

- ✅ **Quyên góp** - Gửi ETH để hỗ trợ chiến dịch
- ✅ **Lịch sử quyên góp** - Xem tất cả quyên góp, xác minh trên blockchain
- ✅ **Hoàn tiền** - Yêu cầu hoàn tiền cho các chiến dịch không thành công
- ✅ **Theo dõi** - Cập nhật real-time trạng thái quyên góp

### 👤 Quản Lý Người Dùng

- ✅ **Chiến dịch của tôi** - Xem tất cả chiến dịch đã tạo
- ✅ **Rút tiền** - An toàn rút tiền khi chiến dịch thành công
- ✅ **Dashboard** - Thống kê gây quỹ và tiến độ

### 🔐 Bảo Mật & Minh Bạch

- ✅ **On-chain verification** - Tất cả dữ liệu ghi lại vĩnh viễn trên blockchain
- ✅ **Xác nhận MetaMask** - Giao dịch an toàn qua ví
- ✅ **Event logging** - Theo dõi tất cả hoạt động qua Sepolia Etherscan
- ✅ **Access control** - Chỉ creator mới có thể quản lý chiến dịch

---

## 📋 Cấu Trúc Repository

```
IE213-KyThuatPhatTrienHeThongWeb/
├── backend/              # Node.js + Express API
│   ├── routes/
│   │   ├── health.routes.js      # Health check
│   │   ├── campaigns.routes.js    # Campaign endpoints
│   │   └── donations.routes.js    # Donation endpoints
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── services/
│   └── package.json
│
├── frontend/             # Next.js + React + Wagmi/Viem
│   ├── app/
│   │   ├── page.tsx                       # Home page + How it works
│   │   ├── campaigns/
│   │   │   ├── page.tsx                  # Campaign list (search/filter/sort)
│   │   │   ├── create/page.tsx           # Create campaign form
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Campaign detail + donate
│   │   │       ├── edit/page.tsx         # Edit campaign (NEW!)
│   │   ├── my-campaigns/page.tsx         # User's campaigns (NEW buttons!)
│   │   ├── donations/page.tsx            # Donation history
│   │   ├── status/page.tsx               # System status
│   │   └── components/
│   ├── lib/
│   │   ├── contracts/                    # Contract config, hooks
│   │   │   ├── hooks.ts                  # useWithdrawFunds, useRefundDonation (NEW!)
│   │   ├── hooks/
│   │   └── providers/
│   └── package.json
│
├── smart_contracts/      # Solidity + Hardhat
│   ├── contracts/
│   │   └── FundRaising.sol               # Main contract (multi-campaign support)
│   ├── test/
│   │   └── FundRaising.test.js           # 67 comprehensive test cases
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
│
├── docs/                 # Comprehensive documentation
│   ├── ARCHITECTURE.md                   # System design & data flows
│   ├── DEPLOYMENT_GUIDE.md               # Deployment instructions
│   ├── OPTIMIZATION_REPORT.md            # Performance optimization
│   └── README.md
│
├── README.md             # (This file)
└── .gitignore
```

---

## 📄 Các Trang Giao Diện

| Trang               | Đường dẫn              | Tính Năng                                            |
| ------------------- | ---------------------- | ---------------------------------------------------- |
| **Home**            | `/`                    | Hero section, How it works, Featured campaigns, FAQs |
| **Campaign List**   | `/campaigns`           | Search/filter/sort campaigns, statistics             |
| **Campaign Detail** | `/campaigns/[id]`      | View details, donate, withdraw/refund buttons        |
| **Create Campaign** | `/campaigns/create`    | Form to create new campaign on-chain                 |
| **Edit Campaign**   | `/campaigns/[id]/edit` | Update title/description (metadata only)             |
| **My Campaigns**    | `/my-campaigns`        | Creator dashboard, manage own campaigns              |
| **My Donations**    | `/donations`           | Donation history, refund tracking                    |
| **System Status**   | `/status`              | Blockchain & network status                          |

---

## 🚀 Quick Start

### Yêu Cầu Môi Trường

- **Node.js 18+**
- **npm hoặc yarn**
- **MetaMask** (kết nối Sepolia testnet)
- **Sepolia ETH** (lấy từ [faucet](https://sepoliafaucet.com))

### Bước 1: Deploy Smart Contract

```bash
cd smart_contracts
npm install

# Tạo .env file
cat > .env << EOF
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x... (từ MetaMask)
EOF

# Compile & test
npm run compile
npm run test

# Deploy lên Sepolia
npm run deploy:sepolia
```

**Lưu địa chỉ contract từ output!**

### Bước 2: Setup Frontend

```bash
cd frontend
npm install

# Tạo .env.local
cat > .env.local << EOF
NEXT_PUBLIC_FUNDRAISING_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
EOF

# Chạy dev server
npm run dev
# Truy cập http://localhost:3000
```

### Bước 3: Setup Backend (Optional)

```bash
cd backend
npm install

cat > .env << EOF
PORT=5000
NODE_ENV=development
EOF

npm run dev
# Backend chạy tại http://localhost:5000
```

---

## ✨ Features

### ✅ Smart Contract (FundRaising.sol)

- ✅ Multiple independent campaigns
- ✅ Create campaign with goal & deadline
- ✅ Donate to specific campaign
- ✅ Auto-complete when goal reached
- ✅ Withdraw funds (creator only)
- ✅ Refund mechanism (failed campaigns)
- ✅ 67 comprehensive test cases
- ✅ Gas-optimized operations

### ✅ Frontend Pages (7 routes)

| Route               | Mô Tả                        |
| ------------------- | ---------------------------- |
| `/`                 | Home - Giới thiệu & thống kê |
| `/campaigns`        | Danh sách campaigns          |
| `/campaigns/[id]`   | Chi tiết campaign + donate   |
| `/campaigns/create` | Tạo campaign mới             |
| `/my-campaigns`     | Campaigns người dùng tạo     |
| `/donations`        | Lịch sử quyên góp            |
| `/status`           | System status check          |

### ✅ Backend APIs

- `/api/health` - Health check
- `/api/campaigns/*` - Campaign endpoints
- `/api/donations/*` - Donation endpoints

---

## 🔧 Kiến Trúc Hệ Thống

### **On-Chain (Smart Contract)**

- Campaign data (tất cả thông tin campaigns)
- Donation records (events)
- Fund management logic
- User contributions tracking

### **Off-Chain (Frontend + Backend)**

- Campaign metadata (images, etc.)
- RPC call caching (30-60s)
- User profiles (optional)
- Database history (optional)

---

## 📊 Tối Ưu Hiệu Năng

- ✅ Smart Contract: Gas optimization (~50% reduction via custom errors)
- ✅ Frontend: Code splitting, image optimization, React Query caching
- ✅ RPC: Intelligent caching reduces calls 90%
- ✅ Estimated cost: $8-15/month vs $100+/month naive approach

**Chi tiết:** Xem [OPTIMIZATION_REPORT.md](docs/OPTIMIZATION_REPORT.md)

---

## 🧪 Testing

```bash
cd smart_contracts
npm run test
# 67 test cases covering all features
# Campaign creation, donations, withdrawals, refunds, edge cases
```

---

## 📚 Tài Liệu

| Tài Liệu                                              | Nội Dung                           |
| ----------------------------------------------------- | ---------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)               | On-chain vs off-chain, data flow   |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)       | Step-by-step deployment & demo     |
| [OPTIMIZATION_REPORT.md](docs/OPTIMIZATION_REPORT.md) | Performance metrics & optimization |

---

## 🔐 Bảo Mật

- ✅ Không lưu private key trên server
- ✅ Sử dụng .env files + .gitignore
- ✅ Custom errors + proper validations
- ✅ Creator-only withdrawals
- ✅ Event-based logging

---

## 📋 Checklist Before Submission

- [ ] Smart contract deployed on Sepolia
- [ ] Contract address saved in .env
- [ ] All tests pass: `npm run test`
- [ ] Frontend works: `npm run dev`
- [ ] No private keys in code
- [ ] .gitignore includes .env files
- [ ] Documentation complete
- [ ] README updated with contract address

---

**Status:** ✅ Ready for Demo & Submission
