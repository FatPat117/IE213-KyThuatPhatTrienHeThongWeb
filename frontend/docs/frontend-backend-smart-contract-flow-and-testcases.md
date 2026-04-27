# Frontend <-> Backend <-> Smart Contract Flow

Tài liệu này mô tả chi tiết:

1. luồng hoạt động giữa `frontend`, `backend`, `smart-contracts`,
2. mapping hàm gọi tương ứng theo từng màn hình,
3. test case flow để team frontend test end-to-end.

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

## 5) Test case flow cho frontend (E2E manual)

> Môi trường đề xuất: Docker compose đầy đủ services + MetaMask Sepolia + ví có SepoliaETH.

## TC-01: SIWE login success

- **Precondition**
  - FE chạy, backend gateway chạy, MetaMask mở.
- **Steps**
  1. Bấm `Kết nối ví`.
  2. Ký message SIWE trong MetaMask.
- **Expected**
  - FE nhận JWT, lưu auth state.
  - Không hiện lỗi ở `WalletConnectButton`.

## TC-02: Guard khi chưa kết nối ví

- **Steps**
  1. Vào `/campaigns/create` khi chưa connect wallet.
- **Expected**
  - Hiện guard card yêu cầu kết nối ví.
  - Không submit được form.

## TC-03: Guard khi sai network

- **Steps**
  1. Chuyển wallet sang chain khác Sepolia.
  2. Vào `/campaigns/create` hoặc donate panel.
- **Expected**
  - Hiện cảnh báo sai mạng.
  - Không cho gửi tx.

## TC-04: Create campaign success + metadata sync

- **Steps**
  1. Connect wallet, ở Sepolia.
  2. Điền form create campaign và submit.
  3. Xác nhận tx trên MetaMask.
- **Expected**
  - UI chuyển trạng thái pending -> confirming -> success.
  - Decode được `createdCampaignId`.
  - Gọi `POST /api/transactions` với action `createCampaign`.
  - Gọi `PUT /api/campaigns/:id/metadata` thành công.
  - Redirect về detail campaign mới.

## TC-05: Campaign list load backend

- **Steps**
  1. Vào `/campaigns`.
- **Expected**
  - Dữ liệu hiển thị từ backend (`GET /api/campaigns`).
  - Search/filter/sort chạy đúng trên dữ liệu đã load.

## TC-06: Donate success

- **Steps**
  1. Vào campaign detail đang active.
  2. Nhập amount và donate.
  3. Confirm MetaMask.
- **Expected**
  - Tx hash hiển thị.
  - Gọi `POST /api/transactions` action `donate`.
  - Event `Donated` được watch, UI history cập nhật.
  - Sau listener xử lý: donation xuất hiện ở `/donations`.

## TC-07: Mint certificate success

- **Precondition**
  - Ví đã donate campaign đó.
- **Steps**
  1. Bấm `Mint Certificate`.
  2. Confirm MetaMask.
- **Expected**
  - Gọi `mintCertificate`.
  - Gọi `POST /api/transactions` action `mintNFT`.
  - Sau listener/consumer hoàn tất, certificate xuất hiện ở `/certificates`.

## TC-08: Withdraw success (creator)

- **Precondition**
  - Campaign đủ điều kiện withdraw.
- **Steps**
  1. Creator bấm `Rút tiền`.
  2. Confirm tx.
- **Expected**
  - Tx confirmed, UI trạng thái rút tiền cập nhật.
  - Event `FundsWithdrawn` được listener nhận (kiểm tra logs backend).

## TC-09: Refund success (donor, failed campaign)

- **Precondition**
  - Campaign ở trạng thái failed, donor có donation.
- **Steps**
  1. Donor bấm `Yêu cầu hoàn tiền`.
  2. Confirm tx.
- **Expected**
  - Tx `claimRefund` confirmed.
  - UI hiển thị hoàn tiền thành công.

## TC-10: Donations page consistency

- **Steps**
  1. Vào `/donations` sau khi đã có vài tx donate.
- **Expected**
  - Danh sách donate khớp backend donation-service.
  - Modal transaction log khớp transaction-service.

## TC-11: My campaigns consistency

- **Steps**
  1. Vào `/my-campaigns`.
- **Expected**
  - Chỉ hiển thị campaign có `creator == wallet hiện tại`.
  - Status/progress hiển thị đúng từ backend.

## TC-12: Error path - reject signature SIWE

- **Steps**
  1. Kết nối ví.
  2. Khi MetaMask hỏi ký SIWE, bấm Reject.
- **Expected**
  - FE hiển thị lỗi auth rõ ràng.
  - Không lưu token.

## TC-13: Error path - reject on-chain tx

- **Steps**
  1. Submit create/donate/mint.
  2. Reject tx trong MetaMask.
- **Expected**
  - FE hiển thị thông báo từ `parsedCreateError`/friendly error.
  - Không stuck loading.

## TC-14: Backend unavailable fallback

- **Steps**
  1. Tắt `campaign-service` hoặc gateway.
  2. Mở `/campaigns` hoặc `/my-campaigns`.
- **Expected**
  - FE hiển thị error state đúng, không crash.

---

## 6) Checklist smoke test nhanh trước release

- [ ] Connect wallet + SIWE login OK.
- [ ] Create campaign OK (on-chain + backend metadata).
- [ ] Donate OK + donation xuất hiện trang `/donations`.
- [ ] Mint certificate OK + hiện trang `/certificates`.
- [ ] Withdraw/refund action đúng role + đúng điều kiện.
- [ ] Campaign list/my-campaigns load từ backend đúng.
- [ ] Tx log modal có dữ liệu và link Etherscan đúng.

---

## 7) Ghi chú giới hạn hiện tại

- `transaction-service` action enum hiện là `donate | createCampaign | mintNFT`.  
  Vì vậy FE chưa ghi log transaction riêng cho `withdraw`/`refund` theo action dedicated.
- `status` toàn hệ thống là eventual consistency (phụ thuộc listener + message queue), có thể trễ vài giây trước khi dữ liệu backend phản ánh đủ.

