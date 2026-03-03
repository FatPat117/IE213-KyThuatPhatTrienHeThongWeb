# Cấu trúc thư mục Backend (Microservices)

Backend được tách thành các **microservices độc lập**, giao tiếp qua API Gateway. Mỗi service có database riêng và xử lý một domain nghiệp vụ cụ thể. Giao tiếp inter-service sử dụng **HTTP REST** (đồng bộ) và **RabbitMQ** (bất đồng bộ).

## Thư mục chính

| Thư mục | Port | Mục đích |
|---------|------|----------|
| **gateway/** | 4000 | API Gateway (http-proxy-middleware): Single entrypoint cho Frontend. |
| **user-service/** | 4001 | Quản lý hồ sơ người dùng (Wallet, Display Name, Avatar). |
| **campaign-service/** | 4002 | Metadata chiến dịch, hình ảnh và trạng thái quyên quỹ. |
| **donation-service/** | 4003 | Lịch sử quyên góp, tin nhắn từ người ủng hộ. |
| **certificate-service/** | 4004 | Metadata và thông tin sở hữu NFT chứng nhận quyên góp. |
| **transaction-service/** | 4005 | Quản lý trạng thái giao dịch (Pending -> Success/Failed). |
| **listener-service/** | - | Lắng nghe Blockchain events (Sepolia) và điều phối dữ liệu qua RabbitMQ/HTTP. |

## Cấu trúc trong mỗi Microservice

Mỗi service (trừ gateway và listener) tuân theo cấu trúc:

- `models/`: Schema Mongoose (MongoDB).
- `services/`: Logic nghiệp vụ chính.
- `controllers/`: Xử lý Request/Response.
- `routes/`: Định nghĩa Endpoint.
- `consumers/`: Lắng nghe tin nhắn từ RabbitMQ (nếu có).
- `config/`: Kết nối DB và RabbitMQ.
- `middlewares/`: Error handling và validation.

## Giao tiếp

1. **Frontend -> Gateway (HTTP):** Mọi request từ client đều đi qua cổng 4000.
2. **Listener -> Services (RabbitMQ):** Khi có event từ Blockchain, Listener sẽ publish message vào Exchange để các service tự cập nhật DB off-chain.
3. **Internal Sync (HTTP):** Một số trường hợp cần kết quả ngay (như update status transaction), Listener sẽ gọi trực tiếp REST API của service.
