# IE213 – Kỹ thuật phát triển hệ thống Web  
# Báo cáo đồ án: Nền tảng gây quỹ & Cấp chứng chỉ NFT (Funding Platform)

## LỜI CẢM ƠN

Nhóm chúng em xin chân thành cảm ơn Thầy/Cô hướng dẫn đã đồng hành và hỗ trợ nhóm trong suốt quá trình thực hiện đồ án. Những góp ý và định hướng của Thầy/Cô giúp nhóm xác định đúng hướng triển khai, củng cố kiến thức chuyên môn về phát triển hệ thống Web, cũng như nâng cao kỹ năng làm việc nhóm và giải quyết vấn đề.

Nhóm cũng xin gửi lời cảm ơn đến nhà trường và các Thầy/Cô đã tạo điều kiện để nhóm có cơ hội học tập, thực hành và hoàn thiện dự án. Dù đã nỗ lực hoàn thiện sản phẩm ở mức tốt nhất, nhóm vẫn khó tránh khỏi thiếu sót; rất mong nhận được những ý kiến góp ý để tiếp tục cải tiến hệ thống.

---

## LỜI MỞ ĐẦU

Trong bối cảnh công nghệ blockchain phát triển mạnh mẽ, nhu cầu minh bạch hóa dòng tiền quyên góp và tăng tính tin cậy cho các chiến dịch gây quỹ ngày càng trở nên quan trọng. Các mô hình gây quỹ truyền thống thường gặp những vấn đề như thiếu minh bạch, khó theo dõi lịch sử giao dịch, và phụ thuộc vào bên trung gian.

Đồ án “Nền tảng gây quỹ & Cấp chứng chỉ NFT (Funding Platform)” được xây dựng nhằm:

- Ghi nhận chiến dịch và giao dịch quyên góp **trực tiếp on-chain** (Ethereum Sepolia).
- Cho phép người dùng tạo chiến dịch, quyên góp, rút tiền khi chiến dịch thành công và hoàn tiền khi chiến dịch thất bại.
- Phát hành **NFT Certificate** cho người quyên góp như một chứng nhận đóng góp.
- Đồng bộ dữ liệu on-chain sang hệ thống off-chain (MongoDB) thông qua Listener + RabbitMQ để cung cấp trải nghiệm UI nhanh, dễ truy vấn và hiển thị lịch sử.

Báo cáo này trình bày quá trình thực hiện dự án trong 5 chương:

- Chương 1: Tổng quan
- Chương 2: Cơ sở lý thuyết
- Chương 3: Phương pháp đề xuất (kiến trúc & luồng xử lý)
- Chương 4: Thực nghiệm (màn hình/chức năng/API)
- Chương 5: Kết luận

---

## MỤC LỤC (gợi ý)

- LỜI CẢM ƠN  
- LỜI MỞ ĐẦU  
- Chương 1. Tổng quan  
- Chương 2. Cơ sở lý thuyết  
- Chương 3. Phương pháp đề xuất  
- Chương 4. Thực nghiệm  
- Chương 5. Kết luận  
- Tài liệu tham khảo  
- Phụ lục (hướng dẫn chạy)

---

## DANH MỤC HÌNH ẢNH (NƠI CẦN CHÈN HÌNH)

> Quy ước: tạo thư mục `docs/images/` và đặt ảnh theo đúng tên file gợi ý bên dưới. Khi có ảnh, chỉ cần thay “(placeholder)” bằng ảnh thật.

| Mã hình | Tên hình (gợi ý) | Nơi chèn | File ảnh gợi ý |
|---|---|---|---|
| Hình A.1 | Kiến trúc tổng quan hệ thống (FE–BE–Chain–Listener–RabbitMQ) | Phần mở rộng A | `docs/images/fig-A1-architecture.png` |
| Hình B.1 | Sequence: SIWE login | Phần mở rộng B.1 | `docs/images/fig-B1-seq-siwe.png` |
| Hình B.2 | Sequence: Create campaign | Phần mở rộng B.2 | `docs/images/fig-B2-seq-create.png` |
| Hình B.3 | Sequence: Donate | Phần mở rộng B.3 | `docs/images/fig-B3-seq-donate.png` |
| Hình B.4 | Sequence: Mint certificate | Phần mở rộng B.4 | `docs/images/fig-B4-seq-mint.png` |
| Hình D.1 | Mô hình dữ liệu MongoDB/ERD (campaign/donation/certificate/transaction/user) | Phần mở rộng D | `docs/images/fig-D1-erd.png` |
| Hình UI.1 | Trang chủ (`/`) | Chương 4.1.1 | `docs/images/ui-01-home.png` |
| Hình UI.2 | Danh sách chiến dịch (`/campaigns`) | Chương 4.1.3 | `docs/images/ui-02-campaigns-list.png` |
| Hình UI.3 | Tạo chiến dịch (`/campaigns/create`) | Chương 4.1.4 | `docs/images/ui-03-create-campaign.png` |
| Hình UI.4 | Detail campaign – info/donate/history | Chương 4.1.5 | `docs/images/ui-04-campaign-detail.png` |
| Hình UI.5 | Detail campaign – creator actions (withdraw/mark failed) | Chương 4.1.5 | `docs/images/ui-05-campaign-creator-actions.png` |
| Hình UI.6 | Detail campaign – refund/mint (donor) | Chương 4.1.5 | `docs/images/ui-06-campaign-refund-mint.png` |
| Hình UI.7 | My campaigns (`/my-campaigns`) | Chương 4.1.6 | `docs/images/ui-07-my-campaigns.png` |
| Hình UI.8 | Donations (`/donations`) + transaction log modal | Chương 4.1.7 | `docs/images/ui-08-donations.png` |
| Hình UI.9 | Certificates (`/certificates`) + filter/sort/print | Chương 4.1.8 | `docs/images/ui-09-certificates.png` |
| Hình UI.10 | Dashboard (`/dashboard`) | Chương 4.1.9 | `docs/images/ui-10-dashboard.png` |
| Hình UI.11 | Leaderboard (`/leaderboard`) | Chương 4.1.10 | `docs/images/ui-11-leaderboard.png` |
| Hình UI.12 | Settings (`/settings`) | Chương 4.1.11 | `docs/images/ui-12-settings.png` |
| Hình UI.13 | Status (`/status`) | Chương 4.1.12 | `docs/images/ui-13-status.png` |
| Hình DEP.1 | Docker compose services running (Docker Desktop/CLI) | Phần K (hướng dẫn chạy) | `docs/images/dep-01-docker-compose-up.png` |
| Hình DEP.2 | RabbitMQ Management UI (queues/exchange) | Phần K | `docs/images/dep-02-rabbitmq-ui.png` |
| Hình DEP.3 | Etherscan tx hash (create/donate/mint/refund/withdraw) | Demo/Thực nghiệm | `docs/images/dep-03-etherscan-tx.png` |

---

## Chương 1. TỔNG QUAN

### 1.1 Lý do chọn đề tài

- Minh bạch hóa dòng tiền quyên góp là yêu cầu thực tế trong các hoạt động gây quỹ cộng đồng.
- Blockchain cho phép công khai kiểm chứng giao dịch, giảm phụ thuộc vào bên trung gian.
- Tuy nhiên, dữ liệu on-chain khó truy vấn/hiển thị theo nhu cầu UI (lọc, tổng hợp, leaderboard…) nên cần cơ chế index off-chain.

### 1.2 Mô tả đề tài và phạm vi

#### 1.2.1 Mô tả đề tài

Hệ thống cung cấp nền tảng gây quỹ cộng đồng gồm các thành phần:

- **Smart contract FundingPlatform**: quản lý chiến dịch, nhận quyên góp, rút tiền/hoàn tiền, mint NFT certificate, và cung cấp hàm đọc dữ liệu on-chain.
- **Frontend (Next.js)**: UI cho tạo chiến dịch, duyệt chiến dịch, xem chi tiết, quyên góp, mint chứng chỉ, lịch sử, dashboard, leaderboard, settings, status.
- **Backend (microservices + gateway)**: lưu metadata chiến dịch, lịch sử quyên góp đã index, lịch sử giao dịch, chứng chỉ NFT đã index, hồ sơ người dùng.
- **Listener-service**: lắng nghe blockchain event (Sepolia), phát sự kiện qua RabbitMQ để các service cập nhật MongoDB.

#### 1.2.2 Phạm vi đề tài

- Mạng blockchain sử dụng: **Ethereum Sepolia testnet**.
- Dữ liệu tài chính (donate/withdraw/refund) được thực hiện on-chain.
- Dữ liệu hiển thị và truy vấn tổng hợp được đồng bộ off-chain (MongoDB) để tối ưu UX.

---

## Chương 2. CƠ SỞ LÝ THUYẾT

### 2.1 Blockchain và Smart Contract

- Blockchain ghi nhận giao dịch theo khối, đảm bảo tính bất biến và công khai kiểm chứng.
- Smart contract là chương trình chạy trên blockchain, tự động hóa logic: tạo chiến dịch, nhận donate, điều kiện rút tiền/hoàn tiền, phát hành NFT.

### 2.2 NFT (ERC-721) cho chứng chỉ quyên góp

- ERC-721 là chuẩn NFT phổ biến, mỗi tokenId là duy nhất.
- Trong hệ thống: mỗi donor sau khi donate có thể mint “DonationCertificate” (CERT) như chứng nhận đóng góp cho một campaign cụ thể.

### 2.3 Kiến trúc Microservices, Event-driven và Indexing off-chain

- Microservices chia theo domain: campaign, donation, certificate, transaction, user…
- Listener-service đọc event on-chain và phát message qua RabbitMQ để các service cập nhật DB.
- Mục tiêu: đảm bảo “eventual consistency” (có thể trễ vài giây) nhưng UI truy vấn nhanh và dễ tổng hợp thống kê.

---

## Chương 3. PHƯƠNG PHÁP ĐỀ XUẤT

### 3.1 Các vai trò và thành phần

#### 3.1.1 Vai trò người dùng

- **Creator**: tạo campaign, theo dõi tiến độ; rút tiền khi campaign thành công.
- **Donor**: quyên góp; yêu cầu hoàn tiền nếu campaign thất bại; mint NFT certificate.
- **Public viewer**: xem danh sách chiến dịch, lịch sử quyên góp on-chain mà không cần kết nối ví (read-only).

#### 3.1.2 Các thành phần hệ thống

- **Frontend (Next.js)**: pages chính:
  - `/` (Home)
  - `/campaigns` (Danh sách chiến dịch)
  - `/campaigns/create` (Tạo chiến dịch)
  - `/campaigns/[id]` (Chi tiết chiến dịch)
  - `/my-campaigns` (Chiến dịch của tôi)
  - `/donations` (Lịch sử quyên góp)
  - `/certificates` (Chứng chỉ NFT)
  - `/dashboard` (Tổng quan tài khoản)
  - `/leaderboard` (Bảng xếp hạng)
  - `/settings` (Cài đặt hồ sơ)
  - `/status` (Trạng thái hệ thống)

- **Backend (API Gateway + microservices)**:
  - Gateway: cổng duy nhất `/api/*`
  - Auth: SIWE nonce/verify để cấp JWT
  - User-service: profile (displayName/avatar)
  - Campaign-service: metadata campaign (title/description/status)
  - Donation-service: lịch sử donate & thống kê top donors
  - Certificate-service: index chứng chỉ NFT theo owner
  - Transaction-service: log trạng thái giao dịch (pending → success/failed)
  - Listener-service: subscribe Sepolia events và publish RabbitMQ

- **Smart contract FundingPlatform (Solidity)**:
  - Hàm chính: `createCampaign`, `donate`, `withdrawFunds`, `claimRefund`, `mintCertificate`, `markAsFailed`, `cancelCampaign`
  - Hàm đọc: `getCampaign`, `getDonation`, `getCertificates`, `isCampaignActive`
  - Events: `CampaignCreated`, `Donated`, `CertificateMinted`, `FundsWithdrawn`, `RefundIssued`, `CampaignCancelled`

### 3.2 Kiến trúc luồng dữ liệu (On-chain + Off-chain)

1) **Người dùng thao tác on-chain** (create/donate/withdraw/refund/mint)  
2) Frontend nhận `txHash`, hiển thị trạng thái pending/confirming/success  
3) Frontend ghi log giao dịch “pending” sang backend (transaction-service) cho một số action (createCampaign/donate/mintNFT)  
4) Listener-service bắt event on-chain, publish RabbitMQ để:
   - Campaign-service / Donation-service / Certificate-service ghi dữ liệu index vào MongoDB
   - Transaction-service được patch status sang `success` (đối với create/donate theo thiết kế hiện tại)
5) Frontend đọc dữ liệu hiển thị từ backend (nhanh, có metadata), đồng thời dùng on-chain read/logs để tăng tính “freshness” và fallback khi backend trễ.

---

## Chương 4. THỰC NGHIỆM

### 4.1 Chức năng hệ thống (đầy đủ theo web hiện tại)

#### 4.1.1 Trang chủ (`/`)

> **[CHÈN HÌNH UI.1]** Screenshot trang chủ: hero + wallet status + contract stats + featured campaigns.  
> File gợi ý: `docs/images/ui-01-home.png`

- Hiển thị **dữ liệu on-chain trực tiếp** (thống kê contract, danh sách chiến dịch nổi bật).
- Hiển thị trạng thái ví:
  - Chưa kết nối: xem chế độ read-only.
  - Sai mạng: cảnh báo “Sai mạng”.
  - Đúng Sepolia: “Đã kết nối Sepolia”.
- Điều hướng nhanh tới:
  - “Bắt đầu chiến dịch” (`/campaigns/create`)
  - “Duyệt chiến dịch” (`/campaigns`)

#### 4.1.2 Kết nối ví + Đăng nhập SIWE (Wallet + JWT)

> **[CHÈN HÌNH]** Ảnh MetaMask popup ký message SIWE + trạng thái “đã đăng nhập” trên UI (nếu có hiển thị).  
> File gợi ý: `docs/images/ui-auth-siwe.png`

- Kết nối MetaMask/Web3 wallet.
- Flow xác thực kiểu SIWE:
  - Frontend xin `nonce` từ backend.
  - User ký message.
  - Backend verify signature và trả JWT + user profile.
- JWT được lưu trong state để gọi các API cần quyền (update profile, create transaction…).

#### 4.1.3 Danh sách chiến dịch (`/campaigns`)

> **[CHÈN HÌNH UI.2]** Screenshot danh sách chiến dịch: search + filter + sort + cards.  
> File gợi ý: `docs/images/ui-02-campaigns-list.png`

- Load danh sách từ backend (metadata title/description) và **merge** dữ liệu on-chain (goal/raised/status) để cập nhật số liệu mới nhất.
- Tìm kiếm theo title/description.
- Lọc theo trạng thái: tất cả / active / ended.
- Sắp xếp: newest / most funded / trending (% funded).
- Guard:
  - Chưa connect: hiển thị chế độ “read-only”.
  - Sai mạng: cảnh báo, vẫn cho xem nhưng hạn chế thao tác on-chain.

#### 4.1.4 Tạo chiến dịch (`/campaigns/create`)

> **[CHÈN HÌNH UI.3]** Screenshot form tạo chiến dịch + trạng thái pending/confirming/success (nếu có).  
> File gợi ý: `docs/images/ui-03-create-campaign.png`

- Guard chặt chẽ:
  - Bắt buộc **kết nối ví**
  - Bắt buộc **mạng Sepolia**
- Form validation:
  - title (<=100), description (<=1000)
  - goal ETH > 0 và <= 1000
  - deadline phải ở tương lai và <= 1 năm
- Submit:
  - Gọi on-chain `createCampaign(beneficiary, goal, durationDays)`
  - Decode event `CampaignCreated` để lấy `campaignId`
  - Ghi transaction pending lên backend: action `createCampaign`
  - Best-effort gọi backend cập nhật metadata campaign (title/description)
  - Redirect sang trang chi tiết campaign mới

#### 4.1.5 Chi tiết chiến dịch (`/campaigns/[id]`)

> **[CHÈN HÌNH UI.4]** Screenshot detail campaign tổng quan (info + donate + history).  
> File gợi ý: `docs/images/ui-04-campaign-detail.png`
>
> **[CHÈN HÌNH UI.5]** Screenshot khu vực creator actions (withdraw/mark failed).  
> File gợi ý: `docs/images/ui-05-campaign-creator-actions.png`
>
> **[CHÈN HÌNH UI.6]** Screenshot khu vực refund/mint (donor).  
> File gợi ý: `docs/images/ui-06-campaign-refund-mint.png`

Trang chi tiết là nơi thực hiện các thao tác nghiệp vụ chính:

- **Xem thông tin campaign** (on-chain + off-chain metadata).
- **Donate**:
  - On-chain `donate(campaignId)` (msg.value là amount)
  - Watch event `Donated` để cập nhật realtime list donations
  - Ghi transaction pending lên backend action `donate` (best-effort)
  - Lịch sử donate được load từ backend trước, fallback sang on-chain logs nếu backend trễ.
- **Withdraw** (creator/beneficiary):
  - On-chain `withdrawFunds(campaignId)` khi campaign success.
  - Guard: chỉ creator/beneficiary, chỉ khi status success, chưa withdrawn.
- **Mark as failed**:
  - On-chain `markAsFailed(campaignId)` khi đã qua deadline và chưa đạt goal.
  - UI dùng để “kích hoạt” trạng thái Failed trước khi donor refund (trong trường hợp cần).
- **Refund** (donor):
  - On-chain `claimRefund(campaignId)` khi campaign failed.
- **Mint certificate** (donor):
  - On-chain `mintCertificate(campaignId)` khi donor đã donate và chưa mint.
  - Có kiểm tra `hasMintedCertificate` và `getDonation` để guard UI.
  - Sau khi mint, backend sẽ index certificate thông qua event `CertificateMinted`.
- **Tổng hợp phụ trợ**:
  - Top donors trong campaign.
  - Tổng số ETH user đã donate cho campaign.

#### 4.1.6 Chiến dịch của tôi (`/my-campaigns`)

> **[CHÈN HÌNH UI.7]** Screenshot trang “Chiến dịch bạn đã tạo”, chia nhóm active/ended/failed.  
> File gợi ý: `docs/images/ui-07-my-campaigns.png`

- Bắt buộc kết nối ví và đúng Sepolia.
- Load campaign từ backend rồi merge on-chain để suy ra status:
  - active / ended / failed (dựa vào goal vs raised và completed)
- Chia theo nhóm trạng thái để quản lý dễ nhìn.

#### 4.1.7 Lịch sử quyên góp (`/donations`)

> **[CHÈN HÌNH UI.8]** Screenshot trang donations + (nếu có) transaction log modal.  
> File gợi ý: `docs/images/ui-08-donations.png`

- 2 chế độ:
  - **Public**: xem lịch sử donate toàn hệ thống (on-chain).
  - **Cá nhân**: khi connect ví & đúng Sepolia, hiển thị “Quyên góp của tôi”.
- Merge dữ liệu:
  - ưu tiên backend indexer (donation-service)
  - bù trễ bằng on-chain logs `Donated` nếu cần
- Hiển thị “Transaction log” từ transaction-service (modal).

#### 4.1.8 Chứng chỉ NFT (`/certificates`)

> **[CHÈN HÌNH UI.9]** Screenshot trang certificates: list + filter/sort + preview/print.  
> File gợi ý: `docs/images/ui-09-certificates.png`

- Bắt buộc connect ví để xem chứng chỉ của chính user.
- Load từ backend: `GET /certificates/owner/:wallet`, `no-store` để luôn lấy mới sau mint.
- Hỗ trợ:
  - Search theo campaign title/owner/displayName
  - Filter theo campaignId
  - Sort newest/oldest/amount (đọc amount từ metadata nếu có)
  - Chuẩn hóa metadata URI: hỗ trợ `ipfs://`, `https://`, `data:application/json;base64,...`
  - Export/in chứng nhận (tạo HTML in theo style hiện tại)

#### 4.1.9 Dashboard (`/dashboard`)

> **[CHÈN HÌNH UI.10]** Screenshot dashboard: summary cards + recent donations + recent certificates.  
> File gợi ý: `docs/images/ui-10-dashboard.png`

- Bắt buộc connect ví.
- Tổng hợp:
  - số lượng quyên góp + tổng ETH đã donate
  - số campaign đã tạo + tổng ETH raised từ campaign của bạn
  - danh sách donate gần đây
  - danh sách certificate gần đây
- Dữ liệu lấy từ backend và một phần fallback theo thiết kế UI.

#### 4.1.10 Leaderboard (`/leaderboard`)

> **[CHÈN HÌNH UI.11]** Screenshot leaderboard: top campaigns + top donors.  
> File gợi ý: `docs/images/ui-11-leaderboard.png`

- Xếp hạng:
  - Top campaigns theo total raised
  - Top donors theo tổng donate
- Ưu tiên backend endpoint `GET /donations/leaderboard/top-donors?limit=10`
- Fallback khi backend lỗi: đọc on-chain logs `Donated` trong khoảng ~2000 block gần nhất (giảm tải RPC).

#### 4.1.11 Settings / Hồ sơ (`/settings`)

> **[CHÈN HÌNH UI.12]** Screenshot settings: displayName + upload avatar + preview.  
> File gợi ý: `docs/images/ui-12-settings.png`

- Bắt buộc connect ví, và cần JWT để update.
- Xem và cập nhật:
  - displayName
  - avatar (data URL), giới hạn 2MB và chỉ image/*
- API:
  - get profile theo wallet
  - update profile yêu cầu token

#### 4.1.12 System status (`/status`)

> **[CHÈN HÌNH UI.13]** Screenshot status page: wallet/network/balance/RPC/contract checks.  
> File gợi ý: `docs/images/ui-13-status.png`

- Kiểm tra nhanh trạng thái hệ thống (diagnostic):
  - Kết nối ví
  - Sai/đúng network
  - Số dư ví (cảnh báo nếu thấp)
  - RPC latency (good/warning/error)
  - Smart contract address/config (đọc campaignCount/totalRaised)
  - Đồng bộ block (latest block number)

#### 4.1.13 Giao diện nộp bằng chứng (`/campaigns/[id]/milestones/upload`)

> **[CHÈN HÌNH UI.14]** Screenshot màn hình upload bằng chứng: chọn mốc, chọn file, upload thành công và hiển thị CID/txHash.  
> File gợi ý: `docs/images/ui-14-milestone-evidence-upload.png`

Màn hình này hiện thực luồng “tải minh chứng -> lưu IPFS -> ghi CID lên blockchain” cho từng mốc giải ngân:

- **Điểm vào UI**:
  - Từ timeline mốc ở `/campaigns/[id]/milestones`, user chọn “Tải minh chứng cho mốc này”.
  - Trang upload nhận `campaignId`, `milestoneId` (query `milestone`) và có thể nhận thêm `sourceCid` để đối chiếu CID hiện tại.

- **Form nộp minh chứng**:
  - Trường nhập gồm: milestone ID, loại bằng chứng (`report/photo/video/document`), tiêu đề, mô tả, file đính kèm.
  - File được gửi theo `multipart/form-data`, field `file`, qua endpoint backend:
    - `POST /api/milestones/:campaignOnChainId/:milestoneIndex/evidence`

- **Xử lý backend (off-chain)**:
  - `campaign-service` nhận file, kiểm tra quyền creator theo `x-wallet-address`.
  - File được upload lên Pinata/IPFS, nhận `CID`.
  - Hệ thống lưu bản ghi `ProgressReport` (campaign, milestone, CID, metadata file, thời gian submit) để truy vấn/audit.

- **Ghi nhận on-chain (source of truth cho proof CID)**:
  - Sau khi backend trả về `CID`, frontend gọi smart contract:
    - `submitMilestoneProof(campaignId, milestoneId, ipfsCid)`
  - Khi transaction được xác nhận, contract phát event `MilestoneReportSubmitted`.
  - `listener-service` bắt event, publish RabbitMQ (`milestone.report.submitted`), `campaign-service` consumer cập nhật trạng thái milestone và danh sách `reportCids`.

- **Trạng thái phản hồi trên UI**:
  - **Thành công toàn bộ**: upload IPFS + ghi blockchain thành công, hiển thị cả `CID` và `txHash`.
  - **Thành công một phần**: upload IPFS thành công nhưng ghi blockchain thất bại -> UI thông báo rõ để user retry bước on-chain.
  - **Thất bại upload**: dừng flow ở backend, không gọi blockchain.

- **Ý nghĩa nghiệp vụ**:
  - Bằng chứng được lưu phân tán (IPFS) để dễ kiểm chứng nội dung.
  - CID được neo on-chain để đảm bảo tính bất biến và truy vết minh bạch trong quy trình giải ngân theo mốc.

---

### 4.2 Smart Contract: FundingPlatform (chức năng on-chain)

#### 4.2.1 Các trạng thái chiến dịch

- `Active`: đang nhận quyên góp
- `Succeeded`: đạt mục tiêu (có thể rút tiền)
- `Failed`: quá deadline, chưa đạt mục tiêu (có thể hoàn tiền)
- `Cancelled`: hủy chiến dịch khi chưa có quyên góp

#### 4.2.2 Các hàm nghiệp vụ

- **Tạo campaign**: `createCampaign(beneficiary, goal, durationDays)`
- **Donate**: `donate(campaignId)` (payable)
- **Rút tiền**: `withdrawFunds(campaignId)` (creator/beneficiary, campaign success)
- **Đánh dấu failed**: `markAsFailed(campaignId)` (sau deadline, chưa đạt goal)
- **Hoàn tiền**: `claimRefund(campaignId)` (campaign failed, donor có donation)
- **Hủy campaign**: `cancelCampaign(campaignId)` (creator/owner, totalRaised==0)
- **Mint certificate NFT**: `mintCertificate(campaignId)` (donor đã donate, chưa mint)

---

### 4.3 Backend microservices và API chính (qua Gateway)

> Ghi chú: Frontend gọi Gateway với prefix `/api/*`. Dưới đây là nhóm endpoint chính theo tài liệu tích hợp.

- **Auth**
  - `POST /api/auth/nonce`
  - `POST /api/auth/verify`

- **Campaign**
  - `GET /api/campaigns`
  - `GET /api/campaigns/:id` (metadata)
  - `PUT /api/campaigns/:id/metadata` (title/description)

- **Donation**
  - `GET /api/donations/donor/:wallet`
  - `GET /api/donations/campaign/:id` (tuỳ triển khai)
  - `GET /api/donations/leaderboard/top-donors?limit=10`

- **Certificate**
  - `GET /api/certificates/owner/:wallet`

- **Transaction**
  - `POST /api/transactions` (tạo pending)
  - `GET /api/transactions/:wallet` (lịch sử)

- **User**
  - `GET /api/users/:wallet`
  - `PUT /api/users/:wallet` (update displayName/avatar)

---

## PHẦN MỞ RỘNG: ĐẶC TẢ CHI TIẾT HỆ THỐNG (BẢN DÀI)

> Phần này bổ sung chi tiết nhằm phục vụ báo cáo đầy đủ theo yêu cầu: kiến trúc, luồng xử lý, đặc tả use-case, mô hình dữ liệu, API, kiểm thử và kịch bản demo.

### A) Kiến trúc tổng quan (Frontend – Backend – Blockchain)

```mermaid
flowchart LR
  U[User / Browser] --> FE[Frontend Next.js]
  FE -->|/api/*| GW[API Gateway]
  GW --> AUTH[auth-service]
  GW --> USER[user-service]
  GW --> CAMP[campaign-service]
  GW --> DON[donation-service]
  GW --> CERT[certificate-service]
  GW --> TX[transaction-service]

  FE -->|RPC (wagmi/viem)| CHAIN[(Ethereum Sepolia)]
  CHAIN -->|Events| LIS[listener-service]
  LIS -->|Publish| MQ[(RabbitMQ)]
  MQ --> CAMP
  MQ --> DON
  MQ --> CERT
  LIS -->|HTTP patch (tuỳ flow)| TX

  CAMP --> DB[(MongoDB)]
  DON --> DB
  CERT --> DB
  TX --> DB
  USER --> DB
```

**Giải thích điểm quan trọng**

- **On-chain là “source of truth”** cho tiền và trạng thái quyên góp (donate/withdraw/refund/mint).
- **Off-chain index** (MongoDB) dùng để tối ưu UX: hiển thị nhanh, tổng hợp leaderboard, lịch sử, join profile…
- **Eventual consistency**: dữ liệu DB có thể trễ vài giây so với blockchain nhưng sẽ “hội tụ” về đúng trạng thái.

### Công nghệ theo lớp (FE/BE)

- **Frontend**: dùng `wagmi` để kết nối wallet và thực thi read/write hợp đồng, kết hợp `viem` để decode/format dữ liệu (`formatEther`, `parseAbiItem`, `decodeEventLog`, ...).
- **Backend (auth-service / listener-service)**: dùng `ethers` để
  - verify chữ ký SIWE trong `auth-service`
  - đọc/tương tác với smart contract trong `listener-service` và các job đồng bộ trạng thái (ví dụ job `markAsFailed`).

### B) Các luồng nghiệp vụ (Sequence Diagrams)

#### B.1 Luồng SIWE: xin nonce → ký message → verify → nhận JWT

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant GW as Gateway
  participant AUTH as Auth Service
  participant MM as MetaMask

  U->>FE: Click Connect/Login
  FE->>GW: POST /api/auth/nonce {wallet}
  GW->>AUTH: forward
  AUTH-->>FE: nonce message
  FE->>MM: signMessage(nonce)
  MM-->>FE: signature
  FE->>GW: POST /api/auth/verify {wallet, signature}
  GW->>AUTH: verify signature
  AUTH-->>FE: {token, user}
  FE-->>U: Logged in (JWT stored)
```

#### B.2 Luồng Create Campaign: on-chain create → decode event → sync metadata

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant CH as Smart Contract
  participant GW as Gateway
  participant TX as Transaction Service
  participant CAMP as Campaign Service
  participant LIS as Listener
  participant MQ as RabbitMQ

  U->>FE: Submit create campaign form
  FE->>CH: createCampaign(beneficiary, goal, durationDays)
  CH-->>FE: txHash
  FE->>GW: POST /api/transactions (pending: createCampaign)
  GW->>TX: create pending record
  CH-->>LIS: emit CampaignCreated
  LIS->>MQ: publish CampaignCreated
  MQ->>CAMP: consumer upsert campaign
  FE->>GW: PUT /api/campaigns/:id/metadata
  GW->>CAMP: save title/description
  FE-->>U: Redirect /campaigns/:id
```

#### B.3 Luồng Donate: on-chain donate → index donation → UI merge backend + on-chain

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant CH as Smart Contract
  participant GW as Gateway
  participant TX as Transaction Service
  participant DON as Donation Service
  participant LIS as Listener
  participant MQ as RabbitMQ

  U->>FE: Donate amount
  FE->>CH: donate(campaignId) value=amount
  CH-->>FE: txHash
  FE->>GW: POST /api/transactions (pending: donate)
  GW->>TX: create pending record
  CH-->>LIS: emit Donated
  LIS->>MQ: publish Donated
  MQ->>DON: consumer insert donation
  LIS-->>TX: patch status success (flow hiện tại)
  FE-->>U: Donation history refresh/watch event
```

#### B.4 Luồng Mint Certificate: mint ERC721 → index theo owner → show ở /certificates

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant CH as Smart Contract
  participant GW as Gateway
  participant TX as Transaction Service
  participant CERT as Certificate Service
  participant LIS as Listener
  participant MQ as RabbitMQ

  U->>FE: Click Mint Certificate
  FE->>CH: mintCertificate(campaignId)
  CH-->>FE: txHash
  FE->>GW: POST /api/transactions (pending: mintNFT)
  GW->>TX: create pending record
  CH-->>LIS: emit CertificateMinted
  LIS->>MQ: publish CertificateMinted
  MQ->>CERT: consumer insert certificate
  FE-->>U: /certificates fetch no-store + auto refresh
```

### C) Đặc tả Use-case (bảng chi tiết)

#### UC01 – Quản lý phiên & đăng nhập (Wallet + SIWE)

| Thuộc tính | Mô tả |
|---|---|
| ID | UC01 |
| Tên | Wallet connect + SIWE login |
| Tác nhân | User |
| Điều kiện trước | Có ví Web3 (MetaMask), wallet connect thành công |
| Điều kiện sau | FE lưu JWT + user profile, gọi được API cần token |
| Luồng cơ bản | (1) Request nonce (2) Sign message (3) Verify signature (4) Store token |
| Luồng thay thế | Reject sign / RPC lỗi / backend lỗi → hiển thị lỗi, không login |
| Độ ưu tiên | Cao |

#### UC02 – Duyệt danh sách chiến dịch

| Thuộc tính | Mô tả |
|---|---|
| ID | UC02 |
| Tên | Browse campaigns |
| Tác nhân | Public viewer / Wallet user |
| Điều kiện trước | Không |
| Điều kiện sau | Xem danh sách, search/filter/sort, vào chi tiết |
| Luồng cơ bản | (1) Load backend campaigns (2) Load on-chain campaigns (3) Merge dữ liệu (4) Render list |
| Luồng thay thế | Backend lỗi → vẫn có thể fallback on-chain (giới hạn metadata) |
| Độ ưu tiên | Cao |

#### UC03 – Tạo chiến dịch

| Thuộc tính | Mô tả |
|---|---|
| ID | UC03 |
| Tên | Create campaign |
| Tác nhân | Creator |
| Điều kiện trước | Wallet connect + Sepolia + có ETH testnet |
| Điều kiện sau | Campaign được tạo on-chain, metadata lưu off-chain |
| Luồng cơ bản | Validate form → createCampaign tx → decode CampaignCreated → create tx record → update metadata |
| Luồng thay thế | Sai mạng / thiếu gas / reject tx → báo lỗi thân thiện |
| Độ ưu tiên | Cao |

#### UC04 – Quyên góp cho chiến dịch

| Thuộc tính | Mô tả |
|---|---|
| ID | UC04 |
| Tên | Donate |
| Tác nhân | Donor |
| Điều kiện trước | Campaign Active, chưa qua deadline |
| Điều kiện sau | Raised tăng on-chain, donation xuất hiện (event + index) |
| Luồng cơ bản | donate tx → watch Donated → index donation → show in /donations |
| Luồng thay thế | Campaign ended/not active → revert; user reject → báo lỗi |
| Độ ưu tiên | Cao |

#### UC05 – Rút tiền khi chiến dịch thành công

| Thuộc tính | Mô tả |
|---|---|
| ID | UC05 |
| Tên | Withdraw funds |
| Tác nhân | Creator/Beneficiary |
| Điều kiện trước | Campaign Succeeded, chưa withdrawn |
| Điều kiện sau | Funds chuyển về beneficiary, event FundsWithdrawn |
| Luồng cơ bản | withdrawFunds tx → confirm → UI refresh |
| Luồng thay thế | Không đúng role/không đủ điều kiện → revert |
| Độ ưu tiên | Cao |

#### UC06 – Hoàn tiền khi chiến dịch thất bại

| Thuộc tính | Mô tả |
|---|---|
| ID | UC06 |
| Tên | Claim refund |
| Tác nhân | Donor |
| Điều kiện trước | Campaign Failed, donor có donation > 0 |
| Điều kiện sau | donor nhận ETH refund, donation reset về 0, event RefundIssued |
| Luồng cơ bản | (1) markAsFailed nếu cần (2) claimRefund tx (3) confirm (4) UI báo thành công |
| Luồng thay thế | Không có donation → revert |
| Độ ưu tiên | Trung bình-Cao |

#### UC07 – Mint chứng chỉ NFT

| Thuộc tính | Mô tả |
|---|---|
| ID | UC07 |
| Tên | Mint certificate |
| Tác nhân | Donor |
| Điều kiện trước | Donor đã donate, chưa mint |
| Điều kiện sau | ERC721 token minted, index ở certificate-service, hiển thị /certificates |
| Luồng cơ bản | mintCertificate tx → CertificateMinted → index DB → fetch list |
| Luồng thay thế | Mint lặp → revert |
| Độ ưu tiên | Cao |

### D) Mô hình dữ liệu Off-chain (MongoDB) – theo domain

> Mục tiêu là mô tả “các collection phục vụ UI”. Trường thực tế có thể khác nhẹ theo service, nhưng ý nghĩa bám sát hệ thống.

#### D.1 Campaign (campaign-service)

| Trường | Kiểu | Diễn giải |
|---|---|---|
| `onChainId` | number | campaignId từ event `CampaignCreated` |
| `creator` | string | ví tạo campaign |
| `beneficiary` | string | ví nhận tiền |
| `goal` | string | wei |
| `raised` | string | wei (đồng bộ từ event/calc) |
| `status` | string | active/ended/failed/cancelled |
| `title` | string | metadata (off-chain) |
| `description` | string | metadata (off-chain) |
| `createdAt` | date | thời gian tạo record |
| `updatedAt` | date | thời gian cập nhật |

#### D.2 Donation (donation-service)

| Trường | Kiểu | Diễn giải |
|---|---|---|
| `txHash` | string | hash donate |
| `campaignOnChainId` | number | campaign id |
| `donorWallet` | string | ví donor |
| `amount` | string | wei |
| `amountEth` | number | ETH (phục vụ UI) |
| `donatedAt` | date/string | thời gian donate (block time hoặc index time) |
| `message` | string? | lời nhắn (nếu có) |

#### D.3 Certificate (certificate-service)

| Trường | Kiểu | Diễn giải |
|---|---|---|
| `tokenId` | number | token id ERC721 |
| `campaignOnChainId` | number | campaign gắn với token |
| `ownerWallet` | string | owner |
| `metadataUri` | string | ipfs/http/data URL |
| `mintedAt` | date/string | thời gian mint |
| `displayName` | string? | snapshot/lookup profile |

#### D.4 Transaction (transaction-service)

| Trường | Kiểu | Diễn giải |
|---|---|---|
| `txHash` | string | tx hash |
| `walletAddress` | string | ví thực hiện |
| `action` | string | createCampaign/donate/mintNFT |
| `campaignOnChainId` | number? | campaign liên quan |
| `status` | string | pending/success/failed |
| `createdAt/updatedAt` | date | timestamps |

#### D.5 User profile (user-service)

| Trường | Kiểu | Diễn giải |
|---|---|---|
| `wallet` | string | địa chỉ ví |
| `displayName` | string | tên hiển thị |
| `avatarUrl` | string | data URL hoặc URL |
| `role` | string | user |

### E) Đặc tả API (chi tiết theo FE đang dùng)

> Ghi chú: Một số endpoint/field phụ thuộc implementation từng service. Phần này bám theo tài liệu tích hợp trong `frontend/docs/*` và cách FE gọi.

#### E.1 Auth

- **POST** `/api/auth/nonce`
  - **Req**: `{ wallet: "0x..." }`
  - **Res**: `{ nonce: "..." }`

- **POST** `/api/auth/verify`
  - **Req**: `{ wallet: "0x...", signature: "0x..." }`
  - **Res**: `{ token: "jwt...", user: { wallet, role, displayName?, avatarUrl? } }`

#### E.2 Campaign

- **GET** `/api/campaigns` → list campaigns (off-chain metadata)
- **GET** `/api/campaigns/:id` → 1 campaign metadata
- **PUT** `/api/campaigns/:id/metadata` (Bearer JWT)
  - **Req**: `{ title: string, description: string }`
  - **Res**: `{ data: campaign }`

#### E.3 Donation

- **GET** `/api/donations/donor/:wallet` → list donation theo ví
- **GET** `/api/donations/leaderboard/top-donors?limit=10` → top donor

#### E.4 Certificates

- **GET** `/api/certificates/owner/:wallet` → list certificate theo ví (FE fetch no-store)

#### E.5 Transactions

- **POST** `/api/transactions` (Bearer JWT)
  - **Req**: `{ txHash, walletAddress, action, campaignOnChainId? }`
- **GET** `/api/transactions/:wallet` → tx history (để show modal)

#### E.6 Users

- **GET** `/api/users/:wallet` → profile
- **PUT** `/api/users/:wallet` (Bearer JWT)
  - **Req**: `{ displayName, avatarUrl }`

### F) Kiểm thử E2E (bản dài – theo checklist trong repo)

> Nguồn: `frontend/docs/frontend-backend-smart-contract-flow-and-testcases.md` và `frontend/docs/frontend-qa-gwt-checklist.md`

#### F.1 Nhóm test: Wallet & Auth

- **TC-01 (SIWE login success)**  
  - Given wallet đã connect  
  - When ký message SIWE  
  - Then nhận token + user profile, lưu auth state

- **TC-02 (Reject SIWE)**  
  - When reject trong MetaMask  
  - Then FE báo lỗi rõ ràng, không lưu token

#### F.2 Nhóm test: Campaign

- **TC-03 (Network guard)**  
  - Given đang ở chain khác Sepolia  
  - When vào `/campaigns/create`  
  - Then không cho submit, hiển thị cảnh báo “Sai mạng”

- **TC-04 (Create campaign)**  
  - When submit create + confirm tx  
  - Then decode được `CampaignCreated`, tạo tx record, metadata sync, redirect detail

#### F.3 Nhóm test: Donate / Mint / Withdraw / Refund

- **TC-05 (Donate)**  
  - When donate success  
  - Then watch Donated update list, donation xuất hiện ở `/donations` sau sync

- **TC-06 (Mint certificate)**  
  - Given đã donate campaign  
  - When mint certificate  
  - Then certificate xuất hiện ở `/certificates` (có thể trễ vài giây)

- **TC-07 (Withdraw)**  
  - Given campaign success  
  - When creator withdraw  
  - Then tx success, UI cập nhật trạng thái

- **TC-08 (Refund)**  
  - Given campaign failed + donor có donation  
  - When claimRefund  
  - Then refund success, UI thông báo

### G) Kịch bản Demo (đề xuất để quay video/thuyết trình)

#### Demo 1 – Public browsing (không cần ví)

1) Vào `/` xem contract stats + featured campaigns  
2) Vào `/campaigns` search/sort/filter + vào detail  
3) Vào `/leaderboard` xem top donors/top campaigns  
4) Vào `/donations` xem lịch sử donate toàn hệ thống (on-chain)

#### Demo 2 – Full flow với ví (Sepolia)

1) Connect wallet + SIWE login  
2) Tạo campaign ở `/campaigns/create`  
3) Dùng ví khác donate, quan sát realtime update  
4) Mint certificate, vào `/certificates` xem certificate  
5) Nếu đạt goal: withdraw bằng creator/beneficiary

#### Demo 3 – Refund flow (campaign failed)

1) Tạo campaign duration ngắn, goal cao  
2) Donate nhỏ, chờ qua deadline  
3) Mark as failed (nếu cần) → claimRefund  
4) Tra cứu tx trên Etherscan Sepolia

---

### H) Bảng mapping theo từng trang (FE → BE → Smart contract/Event)

> Mục tiêu: thể hiện rõ “mỗi trang gọi gì”, giúp giảng viên/QA đối chiếu nhanh giữa UI – API – on-chain.

#### H.1 Trang chủ `/`

| Màn hình | FE files/components | Backend endpoint | Smart contract read/event |
|---|---|---|---|
| Home | `frontend/src/app/page.tsx`, `WalletStatus`, `ContractStatsDisplay`, `CampaignListDisplay` | (không bắt buộc) | Read stats (hook read), danh sách campaign on-chain |

#### H.2 `/campaigns` – Danh sách chiến dịch

| Màn hình | FE files/components | Backend endpoint | Smart contract read/event |
|---|---|---|---|
| Campaigns list | `frontend/src/app/campaigns/page.tsx` | `GET /api/campaigns` | Read all campaigns (hook `useReadAllCampaigns`), merge số liệu on-chain |

#### H.3 `/campaigns/create` – Tạo chiến dịch

| Màn hình | FE files/components | Backend endpoint | Smart contract write/event |
|---|---|---|---|
| Create campaign | `frontend/src/app/campaigns/create/page.tsx`, `CreateCampaignForm*` | `POST /api/transactions` (pending), `PUT /api/campaigns/:id/metadata` | `createCampaign` → event `CampaignCreated` (decode để lấy id) |

#### H.4 `/campaigns/[id]` – Chi tiết chiến dịch

| Nhóm chức năng | FE files/components | Backend endpoint | Smart contract write/read/event |
|---|---|---|---|
| Load metadata + on-chain | `frontend/src/app/campaigns/[id]/page.tsx`, `CampaignInfoPanel` | `GET /api/campaigns/:id` (metadata), `GET /api/donations/campaign/:id` (nếu có) | `getCampaign` (read), logs `Donated` (watch/fetch) |
| Donate | `DonatePanel` | `POST /api/transactions` (pending: donate) | `donate(campaignId)` → `Donated` |
| Withdraw | `CreatorActionsPanel` | (chưa bắt buộc) | `withdrawFunds(campaignId)` → `FundsWithdrawn` |
| Mark failed | `CreatorActionsPanel` | (chưa bắt buộc) | `markAsFailed(campaignId)` |
| Refund | `RefundAndMintPanel` | (chưa bắt buộc) | `claimRefund(campaignId)` → `RefundIssued` |
| Mint certificate | `RefundAndMintPanel` | `POST /api/transactions` (pending: mintNFT) | `mintCertificate(campaignId)` → `CertificateMinted` |

#### H.5 `/my-campaigns` – Chiến dịch của tôi

| Màn hình | FE files/components | Backend endpoint | Smart contract read |
|---|---|---|---|
| My campaigns | `frontend/src/app/my-campaigns/page.tsx` | `GET /api/campaigns` | Read all campaigns (hook) để merge & suy ra status |

#### H.6 `/donations` – Lịch sử quyên góp

| Màn hình | FE files/components | Backend endpoint | Smart contract read/event |
|---|---|---|---|
| Donations | `frontend/src/app/donations/page.tsx`, `DonationHistoryList`, `TransactionHistoryModal` | `GET /api/donations/donor/:wallet`, `GET /api/transactions/:wallet` | Fallback: logs `Donated` + `getBlock` để lấy timestamp |

#### H.7 `/certificates` – Chứng chỉ NFT

| Màn hình | FE files/components | Backend endpoint | Smart contract |
|---|---|---|---|
| Certificates | `frontend/src/app/certificates/page.tsx` | `GET /api/certificates/owner/:wallet` | (index từ event `CertificateMinted`; FE chủ yếu đọc off-chain) |

#### H.8 `/dashboard` – Tổng quan

| Màn hình | FE files/components | Backend endpoint | Smart contract |
|---|---|---|---|
| Dashboard | `frontend/src/app/dashboard/page.tsx` | `GET /api/campaigns`, `GET /api/donations/donor/:wallet`, `GET /api/certificates/owner/:wallet` | (nếu cần fallback/đối chiếu) |

#### H.9 `/leaderboard` – Bảng xếp hạng

| Màn hình | FE files/components | Backend endpoint | Smart contract read/event |
|---|---|---|---|
| Leaderboard | `frontend/src/app/leaderboard/page.tsx` | `GET /api/donations/leaderboard/top-donors?limit=10`, `GET /api/campaigns` | Fallback: logs `Donated` trong ~2000 blocks; read all campaigns |

#### H.10 `/settings` – Hồ sơ người dùng

| Màn hình | FE files/components | Backend endpoint | Smart contract |
|---|---|---|---|
| Settings | `frontend/src/app/settings/page.tsx` | `GET /api/users/:wallet`, `PUT /api/users/:wallet` (JWT) | - |

#### H.11 `/status` – Trạng thái hệ thống

| Màn hình | FE files/components | Backend endpoint | Smart contract read |
|---|---|---|---|
| System status | `frontend/src/app/status/page.tsx` | (không bắt buộc) | Read campaignCount/totalRaised, RPC latency, latest block |

---

### I) Security & Threat Model (rủi ro + cách giảm thiểu)

#### I.1 Tài sản cần bảo vệ (Assets)

- **Quỹ (ETH)** trong các campaign (on-chain).
- **Tính toàn vẹn dữ liệu hiển thị** (DB off-chain không được sai lệch đáng kể so với on-chain).
- **JWT token** và phiên đăng nhập SIWE.
- **Dữ liệu người dùng**: displayName/avatar.
- **Hạ tầng**: RabbitMQ, MongoDB, RPC endpoint.

#### I.2 Kẻ tấn công (Threat actors)

- Người dùng ác ý trên internet (spam API, scan lỗ hổng).
- Đối tượng cố gắng lừa UI hiển thị sai/đánh lừa người xem.
- Tấn công vào hạ tầng (Mongo/RabbitMQ) do cấu hình yếu.
- Tấn công supply chain/dependency (npm packages).

#### I.3 Bề mặt tấn công (Attack surface)

- Public HTTP endpoints qua Gateway (`/api/*`).
- SIWE auth endpoints (nonce/verify).
- RabbitMQ broker (port 5672/15672).
- MongoDB (27017).
- RPC calls & provider (rate limit, poisoned RPC).
- Frontend XSS (avatarDataUrl), injection vào metadata.

#### I.4 Rủi ro chính và cách giảm thiểu

- **Replay/nonce abuse trong SIWE**
  - **Rủi ro**: kẻ tấn công tái sử dụng signature/nonce cũ.
  - **Giảm thiểu**: nonce phải “one-time”, có TTL; verify signature phải kiểm tra domain/uri/chainId/time window; rotate nonce sau verify.

- **JWT bị lộ**
  - **Rủi ro**: token bị lấy cắp (XSS/localStorage leak) → gọi API update profile/tx log.
  - **Giảm thiểu**: hạn chế lưu token ở localStorage; dùng HTTP-only cookie nếu triển khai production; set expiry ngắn; refresh token (nếu có); CORS chặt.

- **Tampering off-chain (DB bị sửa)**
  - **Rủi ro**: hiển thị sai raised/donation/certificate.
  - **Giảm thiểu**: coi on-chain là source of truth; FE merge on-chain override; backend indexer idempotent và đối chiếu event; audit log.

- **API spam / DoS**
  - **Rủi ro**: spam `GET /campaigns`, leaderboard, donations logs; làm nghẽn server/RPC.
  - **Giảm thiểu**: rate limiting tại gateway, caching hợp lý, pagination; giới hạn fallback on-chain (đã làm 2000 blocks + chunk).

- **RabbitMQ exposed**
  - **Rủi ro**: nếu để lộ management UI, attacker có thể publish/consume, phá dữ liệu.
  - **Giảm thiểu**: không expose port management ra public; đổi mật khẩu mặc định; network policy; TLS.

- **MongoDB exposed**
  - **Rủi ro**: truy cập DB trái phép.
  - **Giảm thiểu**: không expose ra public; bật auth; network internal; backup/restore.

- **XSS qua avatar (data URL) / metadata rendering**
  - **Rủi ro**: nếu render HTML không escape có thể XSS.
  - **Giảm thiểu**: chỉ render text; sanitize user input; chặn `data:text/html` (đã giới hạn `image/*`); CSP trong production.

#### I.5 Security checklist (gợi ý cho bản nộp)

- [ ] Bật `helmet` tại gateway và các services.
- [ ] CORS allowlist theo domain.
- [ ] Rate limit (gateway) cho public endpoints.
- [ ] Không commit `.env` (secrets).
- [ ] RabbitMQ/Mongo không public, đổi password mặc định.

---

### J) Performance / Scalability (bottleneck + giải pháp)

#### J.1 Bottleneck chính

- **RPC latency & rate limit**: đọc logs on-chain nhiều (donations/certificates/leaderboard) có thể chậm.
- **N+1 RPC calls**: lấy `getBlock` cho từng log (donations page).
- **Eventual consistency**: UI cần polling/refresh sau tx.
- **RabbitMQ consumer throughput**: burst event nhiều có thể làm lag DB.
- **Mongo query thiếu index**: leaderboard/top donors cần aggregate tốt.

#### J.2 Tối ưu hiện có trong UI (đúng theo code hiện tại)

- Leaderboard fallback chỉ đọc **~2000 blocks** và chia chunk nhỏ.
- Donations page merge backend + on-chain để “bù trễ”, tránh phụ thuộc 100% indexer.
- Certificates page fetch `no-store` + auto refresh 3 lần để bắt kịp index.

#### J.3 Giải pháp tối ưu đề xuất (mở rộng)

- **Batching logs + caching**
  - Cache logs theo block range (memory/redis) để tránh query lại khi reload.
  - Dùng “cursor-based pagination” cho donations list.

- **Giảm N+1 getBlock**
  - Khi fetch nhiều logs, thay vì gọi `getBlock` cho từng log:
    - dùng block timestamp từ indexer (backend)
    - hoặc batch `getBlock` theo unique blockNumber.

- **Idempotency & retry**
  - Consumer xử lý message theo `txHash`/`(campaignId, donor, tokenId)` làm unique key.
  - Retry có backoff; DLQ cho message lỗi.

- **Indexes MongoDB**
  - `donations`: index `donorWallet`, `campaignOnChainId`, `donatedAt`, `txHash (unique)`.
  - `certificates`: index `ownerWallet`, `tokenId (unique)`, `mintedAt`.
  - `transactions`: index `walletAddress`, `txHash (unique)`, `updatedAt`.
  - `campaigns`: index `onChainId (unique)`, `creator`.

- **Backpressure**
  - Giới hạn concurrency consumer; batch writes.
  - Monitor RabbitMQ queue depth + alerting.

---

### K) Hướng dẫn chạy chi tiết (docker compose + ports + env cho từng service)

#### K.1 Ports & services (theo `backend/STRUCTURE.md`)

| Service | Port (local) | Vai trò |
|---|---:|---|
| gateway | 4000 | Single entrypoint `/api/*` |
| auth-service | 4001? (theo env) / default trong doc | SIWE + JWT |
| user-service | 4001 | user profile |
| campaign-service | 4002 | campaign metadata/index |
| donation-service | 4003 | donation history + leaderboard |
| certificate-service | 4004 | certificates index |
| transaction-service | 4005 | tx log pending/success |
| listener-service | - | subscribe event Sepolia → RabbitMQ |
| mongodb | 27017 | database |
| rabbitmq | 5672 / 15672 | broker / management UI |
| frontend | 3000? (theo env) | web UI |

> Port thực tế chạy theo `.env` (biến `*_PORT`) trong `docker-compose.yml`.

#### K.2 Chạy bằng Docker Compose (khuyến nghị)

1) Tạo file `.env` ở root (copy từ `.env.example`), điền tối thiểu:
   - Ports (`GATEWAY_PORT`, `*_SERVICE_PORT`, `FRONTEND_PORT`)
   - `JWT_SECRET`, `JWT_EXPIRES_IN`
   - `MONGO_URI_*` (có thể dùng cùng một Mongo với DB name khác)
   - `RABBITMQ_URL` (trong compose network thường là `amqp://admin:password@rabbitmq:5672`)
   - `SEPOLIA_RPC_URL`
   - `CROWDFUNDING_CONTRACT_ADDRESS` và `NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_API_URL` (thường `http://localhost:${GATEWAY_PORT}/api`)
   - `NEXT_PUBLIC_SEPOLIA_RPC_URL`
   - RabbitMQ exchange/queue/routing keys (theo `.env.example`)

2) Start:

```bash
docker compose up -d --build
```

3) Kiểm tra:
   - Frontend: `http://localhost:<FRONTEND_PORT>`
   - Gateway: `http://localhost:<GATEWAY_PORT>/api/campaigns`
   - RabbitMQ UI: `http://localhost:15672` (admin/password)

#### K.3 Env mẫu theo từng service

> Mỗi service có `.env.example` trong thư mục tương ứng. Khi chạy docker compose, env được lấy từ root `.env`.

- **Gateway** (`backend/gateway/.env.example`)
  - `PORT`, `NODE_ENV`, `JWT_SECRET`
  - `AUTH_SERVICE_URL`, `USER_SERVICE_URL`, `CAMPAIGN_SERVICE_URL`, `DONATION_SERVICE_URL`, `CERTIFICATE_SERVICE_URL`, `TRANSACTION_SERVICE_URL`

- **Auth service** (`backend/auth-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`

- **User service** (`backend/user-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`

- **Campaign service** (`backend/campaign-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`, `RABBITMQ_URL`

- **Donation service** (`backend/donation-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`, `RABBITMQ_URL`
  - (compose còn hỗ trợ cấu hình Etherscan logs API để index/fallback)

- **Certificate service** (`backend/certificate-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`, `RABBITMQ_URL`

- **Transaction service** (`backend/transaction-service/.env.example`)
  - `PORT`, `NODE_ENV`, `MONGO_URI`
  - (compose còn có RabbitMQ queues cho donated/refund issued để cập nhật status)

- **Listener service** (`backend/listener-service/.env.example`)
  - `SEPOLIA_RPC_URL`, `CROWDFUNDING_CONTRACT_ADDRESS`
  - `RABBITMQ_URL`, `TRANSACTION_SERVICE_URL`
  - (tuỳ chọn) MARK_FAILED job: `MARK_FAILED_JOB_*`, `MARK_FAILED_PRIVATE_KEY`

- **Frontend** (`frontend/.env.example`)
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SEPOLIA_RPC_URL`
  - `NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS`

#### K.4 Chạy local không dùng Docker (tùy chọn)

- Cần chạy MongoDB + RabbitMQ trước (local hoặc docker).
- Mỗi service chạy `npm install` rồi `npm run dev` (tùy scripts).
- Gateway phải trỏ đúng các service URLs (localhost ports).

---

## Chương 5. KẾT LUẬN

### 5.1 Ưu điểm

- **Minh bạch**: donate/campaign data được ghi on-chain, dễ kiểm chứng qua explorer.
- **Tự động hóa**: điều kiện rút tiền/hoàn tiền/mint certificate được kiểm soát bởi smart contract.
- **Trải nghiệm tốt**: backend indexer giúp UI hiển thị nhanh, hỗ trợ lọc/sort/tổng hợp.
- **Khả năng mở rộng**: kiến trúc microservices, event-driven giúp tách domain rõ ràng.

### 5.2 Hạn chế

- **Eventual consistency**: dữ liệu off-chain có thể trễ vài giây so với on-chain.
- **Phụ thuộc RPC/testnet**: khi RPC chậm hoặc testnet nghẽn sẽ ảnh hưởng UX.
- **Transaction log hiện tại**: backend transaction action enum tập trung cho `createCampaign | donate | mintNFT`, chưa ghi log riêng cho withdraw/refund theo action dedicated (theo ghi chú trong tài liệu dev).

### 5.3 Hướng phát triển

- Bổ sung index/transaction logging đầy đủ cho withdraw/refund/cancel/markFailed.
- Tối ưu indexer (batching, retry, idempotency) để giảm độ trễ đồng bộ.
- Chuẩn hóa metadata NFT (IPFS) và bổ sung template NFT metadata phong phú hơn.
- Mở rộng tính năng “period leaderboard” (week/month) và các thống kê nâng cao.

---

## TÀI LIỆU THAM KHẢO

- Foundry Book: `https://book.getfoundry.sh/`
- OpenZeppelin Contracts (ERC721, Ownable, ReentrancyGuard)
- Tài liệu nội bộ repo:
  - `frontend/docs/integration-flow.md`
  - `frontend/docs/frontend-backend-smart-contract-flow-and-testcases.md`
  - `frontend/docs/frontend-qa-gwt-checklist.md`
  - `backend/STRUCTURE.md`

---

## PHỤ LỤC: HƯỚNG DẪN CHẠY DỰ ÁN (tóm tắt theo repo hiện tại)

### A. Smart contracts (Foundry)

- Thư mục: `smart-contracts/`
- Cài dependency:
  - `forge install OpenZeppelin/openzeppelin-contracts --no-commit`
  - `forge install foundry-rs/forge-std --no-commit`
- Test:
  - `forge test -vv`

### B. Biến môi trường (cần thiết)

**Frontend**

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SEPOLIA_RPC_URL`
- `NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS`

**Backend/Listener**

- `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `JWT_SECRET`, RabbitMQ/Mongo URIs, ...

### C. Deployment contract (Sepolia)

Theo `README.md` của repo, contract hiện tại đang live trên Sepolia tại địa chỉ:

- `0xCF6eBe1D6aD4d7d097B1cfB8d1eBB195b5710F78`

