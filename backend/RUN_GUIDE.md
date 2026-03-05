# Hướng dẫn Chạy Backend & Test Postman

Tài liệu này hướng dẫn cách khởi động hệ thống Microservices và kiểm tra API.

## 1. Sửa lỗi Docker (Nếu gặp lỗi "unable to get image")

Lỗi thường do **Docker Desktop** chưa được bật hoặc chưa khởi động xong.

**Cách khắc phục:**
1. Mở ứng dụng **Docker Desktop** trên Windows.
2. Chờ biểu tượng Docker ở góc dưới màn hình chuyển sang màu xanh (Engine running).
3. Sau đó mới chạy lại câu lệnh:
   ```bash
   docker compose up -d
   ```

---

## 2. Cách chạy Backend (Khuyên dùng Docker)

Nếu Docker đã sẵn sàng, bạn chỉ cần chạy lệnh sau tại thư mục gốc của dự án:

```bash
docker compose up -d
```
- `-d`: Chạy ngầm (detached mode).
- Hệ thống sẽ tự động tạo MongoDB, RabbitMQ, API Gateway và 6 Microservices.

---

## 3. Cách chạy thủ công (Manual) - Nếu không dùng Docker

Nếu không muốn dùng Docker, bạn phải chạy từng service bằng tay (Yêu cầu đã cài Node.js).

### Bước 1: Khởi động Infrastructure (Bắt buộc)
Bạn vẫn nên dùng Docker cho DB và Message Queue để tiết kiệm thời gian:
```bash
docker compose up -d mongodb rabbitmq
```
*(Nếu cài MongoDB/RabbitMQ trực tiếp trên máy thì bỏ qua bước này).*

### Bước 2: Chạy từng Microservice
Mở nhiều Terminal, vào từng thư mục trong `backend/` (gateway, user-service, campaign-service, ...) và chạy:
```bash
npm install
npm run dev
```

---

## 4. Test API với Postman

Mọi request từ Frontend/Postman đều phải đi qua **API Gateway (Port 4000)**. Các service bên trong sẽ không được gọi trực tiếp.

### Cấu hình chung
- **Base URL:** `http://localhost:4000/api`
- **Headers:** `Content-Type: application/json`

### Các Endpoint chính để Test:

| Service | Method | Route (Postman) | Mô tả |
|---------|--------|------------------|-------|
| **Gateway** | GET | `/health` | Kiểm tra Gateway có sống không |
| **User** | GET | `/users/health` | Test kết nối tới User Service |
| **Campaign**| GET | `/campaigns` | Lấy danh sách chiến dịch |
| **Donation**| POST | `/donations` | Gửi yêu cầu donate |
| **Transaction**| GET | `/transactions/:id` | Xem trạng thái giao dịch |

### Ví dụ thử nghiệm (Health Check):
1. Mở Postman.
2. Tạo request `GET http://localhost:4000/api/health`.
3. Nếu nhận được `{ "success": true, "service": "api-gateway" }` là Gateway đã ok.

---

## 5. Xem Log để Debug
Nếu một API trả về lỗi 502 (Service Unavailable), hãy kiểm tra log của service đó:
```bash
docker compose logs -f [tên-service]
# Ví dụ: docker compose logs -f user-service
```
