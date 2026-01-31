# Gói cần thiết & gợi ý bổ sung – Đồ án IE213

## Đã có (hiện tại)

### Backend
- express, mongoose, cors, dotenv, helmet, morgan, express-validator, nodemon

### Frontend
- next, react, wagmi, viem (kết nối ví + tương tác chain), @tanstack/react-query, tailwindcss, lucide-react, clsx, tailwind-merge

### Smart contracts
- hardhat, @nomicfoundation/hardhat-toolbox, @openzeppelin/contracts, dotenv

---

## Nên cài thêm

### Backend (khi triển khai nghiệp vụ)
- **ethers** hoặc **viem**: đọc dữ liệu từ contract, đồng bộ off-chain (ví dụ: `npm install ethers`).
- **siwe** (Sign-In with Ethereum): nếu dùng đăng nhập bằng ví, backend kiểm tra chữ ký: `npm install siwe`.
- **jest** + **supertest**: kiểm thử API (yêu cầu đồ án):  
  `npm install -D jest supertest` và cấu hình test script.

### Frontend (tùy chọn)
- **axios**: gọi API backend (có thể dùng `fetch` thay thế).
- **@rainbow-me/rainbowkit** hoặc **@web3modal/wagmi**: UI kết nối ví đẹp hơn (wagmi đủ dùng).

### Smart contracts
- Đã đủ. Có thể thêm **hardhat-gas-reporter** nếu muốn báo cáo gas:  
  `npm install -D hardhat-gas-reporter`.

---

## Thư mục tests/ (theo hướng dẫn đồ án)

- **tests/** ở root: có thể dùng cho e2e chung (Playwright/Cypress) hoặc chỉ để tài liệu.
- Hiện tại:
  - **smart_contracts/test/**: test contract (Hardhat).
  - Backend: nên thêm test API (Jest) trong `backend/` khi có API.
  - Frontend: có thể thêm e2e (Playwright) trong `frontend/` hoặc `tests/`.

---

## Lệnh kiểm tra nhanh

```bash
# Smart contracts
cd smart_contracts && npm run compile && npm run test

# Backend
cd backend && npm run dev   # Chạy xong gọi GET http://localhost:5000/health

# Frontend
cd frontend && npm run dev  # Mở http://localhost:3000
```
