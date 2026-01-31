# Cấu trúc thư mục Backend

Backend dùng Express: API REST, MongoDB (Mongoose), phục vụ frontend và đồng bộ dữ liệu off-chain. Kiến trúc **MVC + Services + Utils** phù hợp tích hợp blockchain (verify chữ ký, gọi contract từ server).

| Thư mục | Mục đích |
|---------|----------|
| **config/** | Cấu hình: kết nối DB, biến môi trường. Ví dụ `db.js` kết nối MongoDB. |
| **controllers/** | Chỉ nhận request và trả response: gọi service (hoặc model), format JSON, bắt lỗi. Không chứa logic nghiệp vụ phức tạp. Mỗi file gắn một nhóm API (health, campaign, certificate, auth). |
| **middlewares/** | Middleware dùng chung: xử lý lỗi, xác thực, validate. Ví dụ `errorHandler.js` bắt lỗi toàn cục. |
| **models/** | Schema Mongoose (collection MongoDB). Mỗi file một model: Campaign, Certificate, User... |
| **routes/** | Định nghĩa API: path + method, gắn controller. Ví dụ `health.routes.js`, `campaign.routes.js`, `certificate.routes.js`. |
| **services/** | Logic nghiệp vụ: tính toán gây quỹ, verify chữ ký ví (SIWE), gọi Smart Contract từ server để đồng bộ dữ liệu. Controller gọi service, service gọi model/contract. Ví dụ `AuthService.js`, `CampaignService.js`, `ContractService.js`. |
| **utils/** | Hàm dùng chung: format tiền tệ, kiểm tra địa chỉ ví hợp lệ, parse error. Ví dụ `validator.js`, `format.js`. |

**Luồng:** `routes` → `controllers` → `services` → `models` (và gọi contract/RPC khi cần). `utils` được dùng trong services/controllers/middlewares.

**Quy ước làm việc nhóm:** Một người phụ trách một nhóm nghiệp vụ (campaign, certificate, auth) thì làm trong cùng bộ file: `routes/xxx.routes.js` + `controllers/xxx.controller.js` + `services/xxx.service.js` + `models/xxx.model.js` (nếu cần).
