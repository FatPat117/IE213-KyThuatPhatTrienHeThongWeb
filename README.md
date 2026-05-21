# Đồ án IE213: Hệ Thống Gây Quỹ Cộng Đồng (Community Funding Platform)

## 1. Giới thiệu
Hệ thống gây quỹ cộng đồng minh bạch dựa trên công nghệ Blockchain. Dự án giúp kết nối người kêu gọi vốn và người ủng hộ thông qua hợp đồng thông minh (smart contract), đảm bảo tính minh bạch, an toàn và tự động hóa trong việc quyên góp, rút tiền và hoàn tiền.

**Các tính năng nổi bật (Tương tác Blockchain):**
- Kết nối ví người dùng (MetaMask).
- Đọc/ghi dữ liệu từ Smart Contract: tạo chiến dịch, quyên góp, rút tiền, yêu cầu hoàn tiền.
- Mint NFT chứng nhận cho người quyên góp.
- Quản lý trạng thái giao dịch rõ ràng (đang chờ, thành công, thất bại).
- Xử lý các tình huống thực tế: từ chối giao dịch, lỗi RPC, không đủ gas, sai mạng (chuyển mạng).

## 2. Kiến trúc hệ thống
Hệ thống được thiết kế phân tách rõ ràng giữa các thành phần:
- **Frontend (Next.js):** Giao diện người dùng, kết nối ví Web3, gửi giao dịch và hiển thị trạng thái realtime.
- **Backend (Node.js, Express, MongoDB):** Xử lý dữ liệu off-chain (thông tin chi tiết, hình ảnh chiến dịch) qua kiến trúc Microservices. Đảm bảo an toàn bảo mật, **tuyệt đối không** lưu trữ hoặc quản lý private key của người dùng trên server hay trong code.
- **Smart Contract (Solidity):** Triển khai trên Ethereum Sepolia Testnet để xử lý logic cốt lõi on-chain (quản lý quỹ, đóng góp, refund, mint NFT). Hệ thống sử dụng Safe Multisig để quản trị an toàn.
- **Cơ sở hạ tầng:** Sử dụng Docker, Docker Compose, và Caddy (Reverse Proxy).

## 3. Tối ưu kỹ thuật web
Hệ thống áp dụng các kỹ thuật tối ưu theo yêu cầu đồ án (chi tiết xem trong báo cáo tại `docs/`):
- **Đo lường & Tối ưu hiệu năng:** Cải thiện điểm số Lighthouse trên cả Desktop và Mobile.
- **Giảm dung lượng tải ban đầu:** Áp dụng Code Splitting, Lazy Loading để chỉ tải các thành phần cần thiết.
- **Tối ưu tương tác Web3:** Tích hợp cơ chế cache hợp lý để giảm thiểu số lần gọi RPC lặp lại; cải thiện trải nghiệm người dùng (UX) với các thông báo giao dịch mượt mà, không gây treo giao diện khi chờ xác nhận từ blockchain.

## 4. Thông tin triển khai & Smart Contract
- **Link Demo Online:**
- **Mạng Blockchain:** Ethereum Sepolia Testnet
- **Địa chỉ Smart Contract chính:** `0xC6c147727cE6021e2A309d227c5b73346E38CF72`
- **Mã nguồn Contract:** Nằm tại thư mục `smart-contracts/` (bao gồm code và script deploy/test).
- **Tài liệu chi tiết:** Xem trong thư mục `docs/` (Báo cáo, Slide, Hướng dẫn Multisig).

## 5. Hướng dẫn cài đặt và chạy hệ thống

### Yêu cầu môi trường
- Docker & Docker Compose
- Node.js >= 18.x, Yarn
- Trình duyệt web hiện đại có cài đặt ví MetaMask (và đã chuẩn bị sẵn ETH mạng Sepolia Testnet).

### Các bước khởi động
1. **Clone repository:**
   ```bash
   git clone <link-repo>
   cd IE213-KyThuatPhatTrienHeThongWeb
   ```
2. **Cấu hình môi trường:**
   - Thiết lập file `.env` cho các service (tham khảo file `.env.example` có sẵn trong mỗi thư mục con).
3. **Khởi động bằng Docker Compose:**
   ```bash
   docker compose up -d --build
   ```
   *Lệnh này sẽ tự động build và chạy toàn bộ hạ tầng: Frontend, Backend, Database, và Reverse Proxy.*
4. **Truy cập ứng dụng:**
   - Website chính: [http://localhost:8080](http://localhost:8080) (hoặc theo cấu hình port của Caddy)
   - API Docs (Swagger): [http://localhost:4000/api-docs/](http://localhost/api/docs)

## 6. Hướng dẫn vận hành và Demo chi tiết

1. **Kết nối hệ thống:**
   - Truy cập trang chủ, nhấn "Kết nối ví" và kết nối ví MetaMask.
   - Hệ thống sẽ yêu cầu người dùng chuyển sang mạng **Sepolia Testnet** nếu chưa đúng mạng.

2. **Tạo chiến dịch gây quỹ:**
   - Chuyển đến mục "Tạo chiến dịch". Điền thông tin chi tiết (lưu trữ off-chain tại Backend) và mục tiêu gọi vốn (lưu on-chain).
   - Xác nhận giao dịch trên ví. Giao diện sẽ hiển thị trạng thái "Đang chờ xử lý" và tự động thông báo "Thành công" khi giao dịch được block xác nhận.

3. **Thực hiện quyên góp & Nhận chứng nhận NFT:**
   - Khám phá một chiến dịch đang diễn ra. Nhập số ETH muốn ủng hộ và nhấn "Quyên góp".
   - Ký giao dịch trên MetaMask. Sau khi xác nhận thành công, số tiền quyên góp được ghi nhận realtime.
   - Bạn sẽ tự động nhận được một NFT chứng nhận quyên góp. Bạn có thể kiểm tra NFT này trong danh sách của mình hoặc tra cứu trên Sepolia Etherscan.

4. **Xử lý luồng kết thúc (Rút tiền / Hoàn tiền):**
   - **Chiến dịch thành công:** Chủ chiến dịch có quyền thực hiện lệnh Withdraw (rút tiền) về ví.
   - **Chiến dịch thất bại:** Nếu hết hạn mà không đạt mục tiêu, những người đã quyên góp có thể thực hiện lệnh Refund (hoàn tiền) để lấy lại số ETH.

*(Tất cả các luồng tương tác blockchain trên đều được bắt lỗi cẩn thận: thông báo khi người dùng huỷ giao dịch, không đủ số dư gas, hoặc đường truyền RPC gặp sự cố).*

## 7. Cấu trúc thư mục

```
├── backend/                # Các microservice Node.js (API lưu trữ dữ liệu off-chain)
├── frontend/               # Ứng dụng giao diện người dùng Next.js
├── smart-contracts/        # Mã nguồn Smart Contract (Solidity) và kịch bản deploy/test
├── docs/                   # Tài liệu báo cáo, hướng dẫn demo, slide thuyết trình
├── caddy/                  # Cấu hình reverse proxy
├── tests/                  # (Nếu có) Các kịch bản kiểm thử tự động
├── docker-compose.yml      # Cấu hình quản lý container
└── README.md               # Tài liệu hướng dẫn cài đặt và vận hành
```

---
*Dự án được thực hiện nhằm đáp ứng đầy đủ quy trình kỹ thuật: Thiết kế, lập trình, triển khai và viết tài liệu thuộc môn học IE213.*
