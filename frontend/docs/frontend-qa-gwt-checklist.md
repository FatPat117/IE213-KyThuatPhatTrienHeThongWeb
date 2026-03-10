# Frontend QA Checklist (Given/When/Then)

Tai lieu nay la checklist test thu cong cho QA theo flow frontend da tich hop voi backend va smart contract.
Danh dau `[x]` khi pass, giu `[ ]` neu fail/chua test.

---

## 0) Test setup

- [x] Da chay `docker compose up -d`
- [x] `frontend`, `gateway`, `listener-service`, `rabbitmq`, `mongodb` dang `Up`
- [ ] Vi MetaMask da them network Sepolia (`chainId=11155111`)
- [ ] Vi test co Sepolia ETH de tao campaign/donate
- [x] `NEXT_PUBLIC_SEPOLIA_RPC_URL` va `SEPOLIA_RPC_URL` dang tro dung Sepolia
- [x] `NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS` trung voi `CROWDFUNDING_CONTRACT_ADDRESS`

---

## 1) Smoke check

### 1.1 Open app
- [ ] **Given** services dang chay, **When** mo `http://localhost:3000`, **Then** trang load thanh cong, khong white-screen, khong crash.

### 1.2 API alive
- [ ] **Given** gateway dang chay, **When** frontend goi danh sach campaign, **Then** khong loi ket noi API (`/api/campaigns` phan hoi du lieu).

### 1.3 Wallet connect UI
- [ ] **Given** chua ket noi vi, **When** bam connect wallet, **Then** MetaMask popup hien thi va connect thanh cong.

### 1.4 Network guard
- [ ] **Given** dang o sai network, **When** vao trang can Sepolia, **Then** hien thong bao yeu cau chuyen sang Sepolia.

---

## 2) SIWE authentication

### 2.1 Nonce + sign + verify
- [ ] **Given** wallet da connect, **When** bam dang nhap va ky message SIWE, **Then** frontend luu duoc token va user profile.

### 2.2 Auth persistence
- [ ] **Given** da dang nhap SIWE, **When** reload trinh duyet, **Then** trang van nhan dang user da dang nhap.

### 2.3 Auth-protected calls
- [ ] **Given** da co token, **When** thuc hien action co ghi transaction backend, **Then** request khong bi 401.

---

## 3) Campaign list and detail

### 3.1 Campaign list from backend
- [ ] **Given** co du lieu campaign trong backend, **When** vao trang campaigns, **Then** hien dung list campaign.

### 3.2 Campaign detail on-chain + off-chain
- [ ] **Given** campaign ton tai, **When** vao detail campaign, **Then** thong tin on-chain (goal/raised/status) va metadata (title/description) hien dung.

---

## 4) Create campaign flow

### 4.1 Form validation
- [ ] **Given** nhap thieu/khong hop le, **When** submit form create campaign, **Then** hien loi validation va khong gui transaction.

### 4.2 Create success on Sepolia
- [ ] **Given** form hop le va vi co ETH, **When** submit create campaign va xac nhan trong MetaMask, **Then** transaction thanh cong tren Sepolia.

### 4.3 CampaignCreated sync
- [ ] **Given** tx create da success, **When** listener xu ly event `CampaignCreated`, **Then** campaign moi xuat hien trong backend list.

### 4.4 Metadata update
- [ ] **Given** tx create da confirm, **When** frontend goi cap nhat metadata campaign, **Then** title/description luu dung va doc lai duoc.

### 4.5 Transaction record createCampaign
- [ ] **Given** action create campaign da chay, **When** mo transaction history, **Then** co ban ghi `action=createCampaign` voi txHash dung.

---

## 5) Donate flow

### 5.1 Donate success
- [ ] **Given** campaign dang active, **When** donor nhap so tien va donate, **Then** tx thanh cong tren Sepolia.

### 5.2 Donated event sync
- [ ] **Given** tx donate da success, **When** listener bat event `Donated`, **Then** donation duoc ghi vao backend.

### 5.3 Raised amount update
- [ ] **Given** co donation moi, **When** reload campaign detail/list, **Then** so tien da raised cap nhat dung.

### 5.4 Donations page history
- [ ] **Given** donor da ung ho, **When** vao trang donations, **Then** hien dung lich su donate theo wallet.

### 5.5 Transaction record donate
- [ ] **Given** donate thanh cong, **When** mo transaction history, **Then** co ban ghi `action=donate` va status duoc cap nhat.

---

## 6) Creator actions flow

### 6.1 Withdraw permission guard
- [ ] **Given** user khong phai creator, **When** vao detail campaign, **Then** khong thay nut withdraw.

### 6.2 Withdraw success (neu du dieu kien)
- [ ] **Given** user la creator va campaign du dieu kien rut, **When** bam withdraw va ky tx, **Then** rut thanh cong.

### 6.3 Withdraw reflected
- [ ] **Given** withdraw da thanh cong, **When** reload detail, **Then** campaign status/so du lien quan cap nhat dung.

---

## 7) Refund + Mint certificate flow

### 7.1 Refund visibility guard
- [ ] **Given** campaign khong cho refund, **When** donor vao detail, **Then** khong hien nut refund.

### 7.2 Claim refund success (neu du dieu kien)
- [ ] **Given** donor du dieu kien refund, **When** bam claim refund va ky tx, **Then** tx thanh cong.

### 7.3 Mint certificate guard
- [ ] **Given** donor chua du dieu kien mint, **When** vao detail, **Then** khong hien nut mint certificate.

### 7.4 Mint certificate success
- [ ] **Given** donor du dieu kien mint, **When** bam mint certificate va ky tx, **Then** tx thanh cong va event `CertificateMinted` duoc ghi nhan.

### 7.5 Certificates page sync
- [ ] **Given** da mint thanh cong, **When** vao trang certificates, **Then** hien record certificate moi cua donor.

### 7.6 Transaction record mintNFT
- [ ] **Given** mint thanh cong, **When** mo transaction history, **Then** co ban ghi `action=mintNFT`.

---

## 8) Negative and resilience checks

### 8.1 User reject transaction
- [ ] **Given** MetaMask popup hien ra, **When** user bam Reject, **Then** frontend hien loi than thien, khong crash.

### 8.2 Wrong network action block
- [ ] **Given** user dang o network khac Sepolia, **When** bam action on-chain, **Then** action bi chan va hien thong bao doi network.

### 8.3 Temporary backend delay
- [ ] **Given** listener/backend xu ly cham vai giay, **When** vua giao dich xong, **Then** UI the hien eventual consistency (co loading/refresh) thay vi sai du lieu.

---

## 9) Regression gates before release

- [ ] Frontend lint pass (`npm run lint`)
- [ ] Frontend production build pass (`npm run build`)
- [ ] Khong co console error nghiem trong trong cac flow chinh
- [ ] 100% testcase bat buoc (muc 1 -> 8) da pass

---

## 10) Defect log template (QA)

Su dung mau nay khi testcase fail:

- Test ID:
- Moi truong:
- Wallet:
- Network:
- Preconditions:
- Steps to reproduce:
- Expected:
- Actual:
- Tx hash (neu co):
- API response/log lien quan:
- Screenshot/video:

