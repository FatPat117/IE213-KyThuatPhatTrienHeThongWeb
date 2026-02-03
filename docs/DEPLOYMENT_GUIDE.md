# Hướng Dẫn Deployment & Demo

## Phần 1: Smart Contract Deployment

### 1.1 Chuẩn Bị Môi Trường

**Yêu cầu:**

- Node.js 18+
- Ví MetaMask với Sepolia testnet
- Sepolia ETH (lấy free từ faucet)

**Hardhat config (`hardhat.config.js`) đã cấu hình:**

```javascript
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

### 1.2 Cài Đặt & Deploy

```bash
# 1. Di chuyển vào thư mục smart contracts
cd smart_contracts

# 2. Cài đặt dependencies
npm install

# 3. Tạo file .env
cat > .env << EOF
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x... (copy private key từ MetaMask)
ETHERSCAN_API_KEY=... (optional, để verify contract)
EOF

# 4. Biên dịch contract
npm run compile

# 5. Chạy test trước khi deploy
npm run test

# 6. Deploy lên Sepolia
npm run deploy:sepolia
```

**Output sẽ như sau:**

```
Deploying with account: 0x...
Account balance: 1234567890...
FundRaising deployed to: 0x123abc...
Lưu địa chỉ contract vào .env và frontend/backend:
FUNDRAISING_CONTRACT_ADDRESS=0x123abc...
```

### 1.3 Lưu Contract Address

Sao chép contract address từ output deployment và cập nhật vào:

**File 1: `frontend/.env.local`**

```env
NEXT_PUBLIC_FUNDRAISING_CONTRACT_ADDRESS=0x123abc...
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
```

**File 2: `frontend/lib/contracts/config.ts`**

```typescript
export const CROWDFUNDING_CONTRACT_ADDRESS = "0x123abc..." as Address;
```

**File 3: `smart_contracts/.env`**

```env
DEPLOYED_CONTRACT_ADDRESS=0x123abc...
```

---

## Phần 2: Backend Setup

### 2.1 Cài Đặt & Chạy

```bash
# 1. Di chuyển vào backend
cd backend

# 2. Cài dependencies
npm install

# 3. Tạo .env
cat > .env << EOF
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/fundraising
FUNDRAISING_CONTRACT_ADDRESS=0x123abc...
EOF

# 4. Chạy development server
npm run dev
```

**Kiểm tra backend:**

```bash
curl http://localhost:5000/api/health
# Output: { status: "ok", timestamp: "..." }
```

### 2.2 API Endpoints (Sẵn sàng)

| Endpoint                       | Method | Mô Tả               | Status   |
| ------------------------------ | ------ | ------------------- | -------- |
| `/api/health`                  | GET    | Kiểm tra server     | ✅       |
| `/api/campaigns`               | GET    | Danh sách campaigns | 🟡 Draft |
| `/api/campaigns/:id`           | GET    | Chi tiết campaign   | 🟡 Draft |
| `/api/campaigns`               | POST   | Tạo campaign        | 🟡 Draft |
| `/api/donations`               | POST   | Ghi donation        | 🟡 Draft |
| `/api/donations/user/:address` | GET    | Donations của user  | 🟡 Draft |

(Đối với dự án này, frontend query contract trực tiếp, nên API routes ở mức draft/skeleton)

---

## Phần 3: Frontend Setup

### 3.1 Cài Đặt & Chạy

```bash
# 1. Di chuyển vào frontend
cd frontend

# 2. Cài dependencies
npm install

# 3. Chạy dev server
npm run dev

# Frontend sẽ có sẵn tại http://localhost:3000
```

### 3.2 Pages & Routes

| Route               | Tên             | Mô Tả                                          |
| ------------------- | --------------- | ---------------------------------------------- |
| `/`                 | Home            | Giới thiệu, thống kê chung, featured campaigns |
| `/campaigns`        | Campaigns       | Danh sách tất cả campaigns                     |
| `/campaigns/[id]`   | Campaign Detail | Chi tiết 1 campaign + donate                   |
| `/campaigns/create` | Create Campaign | Form tạo campaign mới                          |
| `/my-campaigns`     | My Campaigns    | Các campaign user đã tạo                       |
| `/donations`        | My Donations    | Lịch sử quyên góp của user                     |
| `/status`           | System Status   | Kiểm tra trạng thái hệ thống                   |

---

## Phần 4: Demo Workflow (Complete Journey)

### **Scenario: Tạo Campaign & Donate**

#### Step 1: Kết Nối Ví

```
1. Truy cập http://localhost:3000
2. Nhấn "Connect Wallet" (nếu chưa)
3. Approve MetaMask connection
4. Chọn Sepolia network
```

#### Step 2: Tạo Campaign

```
1. Nhấn "Tạo mới" hoặc "/campaigns/create"
2. Điền form:
   - Title: "Xây Thư Viện Trường Tiểu Học"
   - Description: "Hỗ trợ xây dựng thư viện cho trường tiểu học huyện X"
   - Goal ETH: "5.0"
   - Duration: "30" days
3. Nhấn "Create Campaign"
4. Approve MetaMask transaction
5. Chờ confirmation (~15-30s trên Sepolia)
```

**Điểm đặc biệt:**

- Transaction hash hiển thị → click xem trên Etherscan
- Real-time status: Pending → Confirming → Success
- Auto-redirect khi success

#### Step 3: Xem Campaign Vừa Tạo

```
1. Nhấn "View Campaign" hoặc vào /campaigns
2. Tìm campaign vừa tạo (top of list)
3. Xem chi tiết:
   - Progress bar: 0 / 5.0 ETH
   - Status: Active (còn 29 days)
   - Creator: Your Address
```

#### Step 4: Donate to Campaign (Từ ví khác)

```
Option A: Dùng ví khác trong MetaMask
  1. Switch account
  2. Vào /campaigns/0 (campaign ID)
  3. Input donation amount: "1.5"
  4. Nhấn "Donate"
  5. Approve transaction

Option B: Hoặc từ cùng ví
  1. Vào /campaigns/0
  2. Input: "1.5"
  3. Approve
```

**Hành động on-chain:**

- ✅ Donation recorded: contributions[0][donor] += 1.5 ETH
- ✅ Event: DonationReceived(0, donor, 1.5 ETH, 1.5 ETH)
- ✅ Progress bar cập nhật: 1.5 / 5.0 ETH = 30%

#### Step 5: View Campaign Chi Tiết

```
1. Vào /campaigns/0
2. Xem:
   - Campaign info: title, description, creator
   - Progress: 1.5 / 5.0 ETH (30%)
   - Timeline: Deadline in 29 days
   - Recent donations list (nếu có)
   - Donate button (nếu campaign active)
```

#### Step 6: Xem My Donations

```
1. Nhấn "Donations" hoặc vào /donations
2. Thấy:
   - Campaign "#0: Xây Thư Viện..."
   - Amount: 1.5 ETH
   - Transaction hash (link Etherscan)
   - Timestamp
```

#### Step 7: Xem My Campaigns

```
1. Nhấn hoặc vào /my-campaigns
2. Thấy:
   - Campaign "#0: Xây Thư Viện..."
   - Status: Active (green badge)
   - Progress: 1.5 / 5.0 ETH
   - Days remaining: 29
   - "View Details" button
```

#### Step 8: Withdrawal (Khi Campaign Thành Công)

```
Scenario: Reach goal (5 ETH)

1. Someone donates final 3.5 ETH
2. Progress reaches 100% → Status changes to "Completed"
3. Creator vào /campaigns/0
4. System enables "Withdraw Funds" button
5. Creator clicks withdraw → MetaMask confirmation
6. Transaction: withdraw() tại contract
7. Funds transferred to creator wallet
8. Status changes to "Withdrawn"
```

#### Step 9: Withdrawal (Khi Campaign Thất Bại)

```
Scenario: Deadline passed, goal not reached

1. Chờ 31+ days
2. Xem /campaigns/0 → Status: "Ended"
3. Creator có thể withdraw (refund donors?)
   - Nếu muốn: Click "Withdraw"
   - Nếu không: Donors tự call refund()

4. Donor vào /donations
5. Click "Request Refund" button
6. Transaction: refund() tại contract
7. Get back: 1.5 ETH
```

---

## Phần 5: System Status Check

### Trang `/status`

Hiển thị real-time system health:

```
✓ Wallet Connection: Connected (0x123...abc)
✓ Network: Sepolia
✓ Balance: 0.5 ETH
✓ Block Number: 12345678 (latest)
✓ Contract RPC Calls: Successful
✓ Campaign Count: 5
✓ Total Raised: 12.5 ETH
⚠️ RPC Latency: 145ms
```

**Giúp debug:**

- Ví kết nối đúng không?
- Network đúng không?
- Contract accessible không?
- RPC working?

---

## Phần 6: Troubleshooting

### Issue 1: "Contract address not found"

```
Solution:
1. Kiểm tra .env.local có NEXT_PUBLIC_FUNDRAISING_CONTRACT_ADDRESS
2. Kiểm tra contract được deploy đúng không
3. Kiểm tra contract address có format đúng (0x...)
```

### Issue 2: "Wallet not connected"

```
Solution:
1. Click "Connect Wallet"
2. Approve MetaMask
3. Kiểm tra network là Sepolia
4. Refresh page
```

### Issue 3: "Transaction timeout or failed"

```
Solution:
1. Kiểm tra account có gas (Sepolia ETH)
2. Kiểm tra network status (lấy faucet ETH nếu cần)
3. Chờ 30-60s, RPC có thể chậm
4. Xem Etherscan để check status
```

### Issue 4: "Campaign created but không thấy"

```
Solution:
1. Refresh page /campaigns
2. Chờ block confirmation (15-30s)
3. Xem console.log output để verify transaction
4. Kiểm tra contract address đúng không
```

---

## Phần 7: Kiểm Tra on Etherscan (Sepolia)

### Step:

1. Vào https://sepolia.etherscan.io
2. Paste contract address (0x...)
3. Xem:
    - Contract code
    - Transactions (list of all calls)
    - Events (DonationReceived, etc.)
    - State (campaignCount, totalRaised)

### Example: Check Donation

```
1. Vào Etherscan → Contract
2. Click "Events" tab
3. Tìm DonationReceived event
4. Xem:
   - campaignId: 0
   - donor: 0xABC...
   - amount: 1500000000000000000 (1.5 ETH in wei)
```

---

## Phần 8: Performance Optimization Checklist

### Frontend:

- [x] Wagmi + Viem (optimized blockchain interaction)
- [x] React Query (caching on-chain data)
- [x] Next.js (automatic code splitting)
- [ ] Lighthouse audit (measure performance)
- [ ] Add lazy loading for campaign list
- [ ] Cache campaign data (staleTime: 60s)

### Smart Contract:

- [x] Events instead of storage (cheaper gas)
- [x] Custom errors (cheaper than strings)
- [x] View functions for batch reads
- [ ] Batch donations (multiple campaigns in 1 tx)

### RPC Optimization:

- [x] Configured staleTime (30-60s cache)
- [x] Refetch on window focus (intelligent updates)
- [x] Batch event queries
- [ ] Add webhook for real-time updates (optional)

---

## Summary

**To Demo:**

1. Deploy contract → get address
2. Set address in `.env.local`
3. Run frontend: `npm run dev`
4. Connect wallet → Create campaign → Donate → Withdraw
5. Check `/status` for system health
6. Verify on Etherscan

**Total time:** ~5-10 minutes (after setup)

**Files to commit to GitHub:**

- ✅ All source code
- ✅ Test files
- ❌ `.env` files (add to .gitignore)
- ❌ Private keys

---

## Live Demo Link

Once deployed:

- Frontend: https://your-vercel-app.vercel.app
- Contract: https://sepolia.etherscan.io/address/0x...

(Update this section after deployment)
