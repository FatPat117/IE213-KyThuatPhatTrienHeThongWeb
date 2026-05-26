# Tài liệu đồ án IE213 – Hệ Thống Gây Quỹ Cộng Đồng & Cấp Chứng Chỉ

Thư mục `docs/` này lưu trữ toàn bộ các tài liệu liên quan đến việc báo cáo, thuyết trình và hướng dẫn sử dụng/vận hành hệ thống theo đúng quy trình kỹ thuật yêu cầu của đồ án.

## 📝 Nội dung đánh giá đồ án

Hệ thống đã hoàn thiện theo các tiêu chí đánh giá của giảng viên, bao gồm:
1. **Chức năng & luồng nghiệp vụ:** Đầy đủ Frontend, Backend, kết nối ví.
2. **Tích hợp Ethereum:** Đã deploy contract lên Testnet, tương tác hoàn chỉnh on-chain và xử lý lỗi (RPC, gas, mạng).
3. **Tối ưu kỹ thuật web:** Tối ưu Lighthouse, giảm số lần gọi RPC lặp thừa, tối ưu UX khi tương tác Web3.
4. **Thiết kế kiến trúc & An toàn:** Phân tách rõ dữ liệu on-chain/off-chain, không lưu trữ private key trên server.

## 🔗 Thông tin triển khai & Tương tác Blockchain

- **Mạng Testnet sử dụng:** Ethereum Sepolia Testnet.
- **Địa chỉ Smart Contract:** `0xC6c147727cE6021e2A309d227c5b73346E38CF72`
- **Link Demo Online:**
- **Backend** http://20.17.163.158/api
- **Frontend** https://ie-213-ky-thuat-phat-trien-he-thong-delta.vercel.app/

> **Lưu ý:** Hướng dẫn cài đặt và vận hành hệ thống chi tiết (bao gồm Docker, cấu hình môi trường) đã được đặt tại [README.md](../README.md) ở thư mục gốc của dự án.

## 📁 Các file tài liệu trong thư mục này

- `REPORT.docx` (hoặc Báo cáo PDF) - Báo cáo đồ án chi tiết (kiến trúc, thiết kế, phân tích, tối ưu).
- `SLIDE.pdf` - Slide thuyết trình bảo vệ đồ án.

## 📚 Multisig Administration Guides

Dự án sử dụng **Safe multisig** để quản trị contract, đảm bảo tính bảo mật. Xem các hướng dẫn chi tiết:

1. **[Tìm hiểu về Ví Safe Multisig và Ứng dụng trong dự án](what-is-safe-multisig.md)**
Bài viết giới thiệu cơ bản về Multisig, cách tạo ví và vai trò của nó trong hệ thống.

2. **[Transfer Ownership to Safe Multisig](transfer-ownership-to-safe-multisig.md)**
Hướng dẫn cho current contract owner để chuyển ownership sang Safe multisig contract.

3. **[Multisig Admin Operations Guide](multisig-admin-operations-guide.md)**
Hướng dẫn cho admin team (các owners của Safe multisig) về cách sử dụng Safe UI để:
   - Thêm/xóa reviewer Safe
   - Approve campaign
   - Workflow multisig: propose → confirm → execute

---
