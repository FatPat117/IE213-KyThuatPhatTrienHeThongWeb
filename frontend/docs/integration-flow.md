# Integration Flow (Frontend - Backend - Smart Contract)

Tài liệu này tập trung cho Dev: kiến trúc tích hợp, mapping hàm gọi, endpoint và event.

---

## 1) Kiến trúc tổng quan

- **Frontend**
  - UI pages: `campaigns`, `campaign detail`, `create campaign`, `donations`, `my-campaigns`, `certificates`.
  - On-chain calls qua wagmi/viem hooks trong `frontend/src/lib/contracts/hooks.ts`.
  - Backend calls qua API wrappers trong `frontend/src/lib/api/*.ts`.
  - SIWE auth + JWT state trong `frontend/src/lib/context/auth.tsx`.

- **Backend (microservices sau gateway)**
  - API Gateway route prefix: `/api/*` (`backend/gateway/index.js`).
  - Auth: `/api/auth/*`.
  - Campaign: `/api/campaigns/*`.
  - Donation: `/api/donations/*`.
  - Certificate: `/api/certificates/*`.
  - Transaction: `/api/transactions/*`.

- **Smart Contract**
  - Contract: `FundingPlatform` (`smart-contracts/src/FundingPlatform.sol`).
  - Hàm chính: `createCampaign`, `donate`, `withdrawFunds`, `claimRefund`, `mintCertificate`, `getCampaign`, `hasMintedCertificate`.
  - Event chính: `CampaignCreated`, `Donated`, `CertificateMinted`, `FundsWithdrawn`, `CampaignCancelled`.

- **Listener + Event Sync**
  - `listener-service` subscribe event on-chain rồi publish RabbitMQ (`backend/listener-service/index.js`).
  - Các service consume event để ghi MongoDB.
  - Listener patch trạng thái transaction sang `success` cho flow create/donate (`publishCampaignCreated`, `publishDonated`).

---

## 2) Env và cấu hình bắt buộc

### Frontend public env

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SEPOLIA_RPC_URL`
- `NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS`

### Backend/infra private env (không được đưa vào frontend)

- `JWT_SECRET`, `DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL` (backend/listener/deploy), RabbitMQ/Mongo URIs...

---

## 3) Mapping hàm gọi chi tiết theo luồng nghiệp vụ

## 3.1 Kết nối ví + SIWE đăng nhập

### Frontend

- Component: `frontend/src/components/wallet/WalletConnectButton.tsx`
- Hàm gọi:
  - `requestNonce(wallet)` -> `frontend/src/lib/api/auth.ts`
  - `signMessageAsync({ message: nonce })` (wagmi)
  - `verifyWalletSignature(wallet, signature)` -> `frontend/src/lib/api/auth.ts`
  - `setAuth(token, user)` -> `frontend/src/lib/context/auth.tsx`

### Backend

- `POST /api/auth/nonce` -> `getNonce` (`backend/auth-service/controllers/auth.controller.js`)
- `POST /api/auth/verify` -> `verifySignature`
- Kết quả: trả `token` (JWT) + `user`.

---

## 3.2 Load danh sách campaigns (backend-first)

### Frontend

- Page: `frontend/src/app/campaigns/page.tsx`
- Hook:
  - `useBackendCampaigns()` -> `frontend/src/lib/hooks/use-backend-data.ts`
  - internally gọi `getCampaigns()` -> `frontend/src/lib/api/campaigns.ts`

### Backend

- `GET /api/campaigns` -> `getAllCampaigns` (`backend/campaign-service/controllers/campaign.controller.js`)

---

## 3.3 Tạo campaign

### Frontend

- Page orchestration: `frontend/src/app/campaigns/create/page.tsx`
- Form UI: `frontend/src/components/campaign-create/CreateCampaignForm.tsx`
- On-chain write:
  - `useCreateCampaign().createCampaign(beneficiary, goalEth, durationDays)`
  - hook định nghĩa ở `frontend/src/lib/contracts/hooks.ts`
- Decode event:
  - `decodeEventLog(..., eventName: "CampaignCreated")` để lấy `createdCampaignId`
- Transaction sync backend:
  - `createTransaction(token, { txHash, walletAddress, action: "createCampaign", campaignOnChainId })`
  - API wrapper: `frontend/src/lib/api/transactions.ts`
- Metadata sync backend:
  - `updateCampaignMetadata(createdCampaignId, token, { description })`

### Smart contract

- Hàm gọi: `createCampaign(address _beneficiary, uint256 _goal, uint256 _durationDays)`
- Event phát: `CampaignCreated(id, creator, beneficiary, goal, deadline)`

### Backend listener

- `listener-service` nghe `CampaignCreated`, publish queue, patch tx status success:
  - `backend/listener-service/publishers/campaignCreated.publisher.js`

---

## 3.4 Xem campaign detail + donate + withdraw + refund + mint

### Frontend (detail page)

- Page: `frontend/src/app/campaigns/[id]/page.tsx`
- Panels:
  - info: `CampaignInfoPanel.tsx`
  - creator actions: `CreatorActionsPanel.tsx`
  - refund/mint: `RefundAndMintPanel.tsx`
  - donate: `DonatePanel.tsx`

### On-chain reads

- `useReadCampaign(id)` -> đọc `getCampaign`
- `useReadContract(functionName: "hasMintedCertificate", args: [campaignId, wallet])`
- `useWatchContractEvent(eventName: "Donated")` để cập nhật list donate realtime

### On-chain writes

- Donate:
  - `useDonateToCampaign().donate(id, amountEth)` -> contract `donate(uint256)`
- Withdraw:
  - `useWithdrawFunds().withdrawFunds(id)` -> contract `withdrawFunds(uint256)`
- Refund:
  - `useRefundDonation().refund(id)` -> contract `claimRefund(uint256)`
- Mint certificate:
  - `useMintCertificate().mintCertificate(id)` -> contract `mintCertificate(uint256)`

### Backend sync

- Khi có `hash` donate/mint, FE gọi:
  - `createTransaction(token, { action: "donate" | "mintNFT", ... })`
- Metadata campaign detail load:
  - `useBackendCampaign(id)` -> `getCampaignById(id)` (để lấy title/description off-chain)

---

## 3.5 Donations page (backend-indexed)

### Frontend

- Page: `frontend/src/app/donations/page.tsx`
- Hook:
  - `useBackendDonations(wallet)` -> `getDonationsByWallet(wallet)` -> `GET /api/donations/donor/:wallet`
  - `useBackendTransactions(wallet)` -> `getTransactionsByWallet(token, wallet)` -> `GET /api/transactions/:wallet`

### Backend

- Donation controller: `backend/donation-service/controllers/donation.controller.js`
- Transaction controller: `backend/transaction-service/controllers/transaction.controller.js`

### Data source gốc

- Donations được listener ghi từ event `Donated`.
- Transactions được FE tạo `pending`, sau đó listener patch `success` (đối với create/donate).

---

## 3.6 My campaigns page

### Frontend

- Page: `frontend/src/app/my-campaigns/page.tsx`
- Dữ liệu từ `useBackendCampaigns()`, rồi filter theo `creator === connectedWallet`.

### Backend

- `GET /api/campaigns`

---

## 3.7 Certificates page

### Frontend

- Page: `frontend/src/app/certificates/page.tsx`
- Call: `GET /api/certificates/owner/:wallet`

### Backend + Listener

- Listener publish khi event `CertificateMinted` (`publishCertificateMinted.publisher.js`).
- Certificate service consume và ghi DB.
- Frontend load từ DB đã sync.

---

## 4) Bảng mapping nhanh (FE -> BE -> SC)

| Flow | FE function/component | BE endpoint/controller | SC function/event |
|---|---|---|---|
| SIWE login | `requestNonce`, `verifyWalletSignature` in `WalletConnectButton` | `POST /api/auth/nonce`, `POST /api/auth/verify` | - |
| Campaign list | `useBackendCampaigns -> getCampaigns` | `GET /api/campaigns` | - |
| Campaign detail read | `useReadCampaign` + `useBackendCampaign` | `GET /api/campaigns/:id` (metadata) | `getCampaign` |
| Create campaign | `useCreateCampaign().createCampaign` | `POST /api/transactions`, `PUT /api/campaigns/:id/metadata` | `createCampaign`, `CampaignCreated` |
| Donate | `useDonateToCampaign().donate` | `POST /api/transactions` | `donate`, `Donated` |
| Withdraw | `useWithdrawFunds().withdrawFunds` | (không bắt buộc endpoint FE hiện tại) | `withdrawFunds`, `FundsWithdrawn` |
| Refund | `useRefundDonation().refund` | (không bắt buộc endpoint FE hiện tại) | `claimRefund` |
| Mint certificate | `useMintCertificate().mintCertificate` | `POST /api/transactions` | `mintCertificate`, `CertificateMinted` |
| Donation history | `useBackendDonations` | `GET /api/donations/donor/:wallet` | dữ liệu từ event `Donated` đã index |
| Tx history | `useBackendTransactions` | `GET /api/transactions/:wallet` | status cập nhật từ listener |
| Certificates | `fetch /api/certificates/owner/:wallet` | `GET /api/certificates/owner/:wallet` | dữ liệu từ event `CertificateMinted` |

---

## 5) Ghi chú giới hạn hiện tại

- `transaction-service` action enum hiện là `donate | createCampaign | mintNFT`.
  Vì vậy FE chưa ghi log transaction riêng cho `withdraw`/`refund` theo action dedicated.
- `status` toàn hệ thống là eventual consistency (phụ thuộc listener + message queue), có thể trễ vài giây trước khi dữ liệu backend phản ánh đủ.
