# Hướng dẫn chuyển Quyền sở hữu (Ownership) sang Safe Multisig

Tài liệu này hướng dẫn người triển khai (Deployer) hợp đồng ban đầu cách chuyển quyền sở hữu (ownership) sang ví Safe Multisig để bắt đầu cơ chế quản trị phi tập trung.

## Các bước thực hiện

1. **Chuẩn bị địa chỉ Safe:** Đảm bảo ví Safe Multisig đã được tạo thành công trên [app.safe.global](https://app.safe.global/) và bạn đã copy chính xác địa chỉ ví Safe (ví dụ: `0x123...abc`).
2. **Truy cập Smart Contract:** 
   - Bạn có thể thao tác thông qua [Sepolia Etherscan](https://sepolia.etherscan.io/) (mục *Contract* -> *Write Contract* nếu đã verify code).
   - Hoặc sử dụng các công cụ lập trình như Remix IDE, Hardhat/Foundry Console với ví Deployer.
3. **Gọi hàm chuyển quyền:**
   - Kết nối ví của người đang giữ quyền Owner hiện tại (chính là ví Deployer).
   - Tìm đến hàm `transferOwnership(address newOwner)` (hoặc hàm tương đương trong code hợp đồng của bạn).
   - Nhập tham số `newOwner` là địa chỉ của ví Safe Multisig.
   - Gửi giao dịch (Write / Send) và bấm xác nhận trên trình duyệt MetaMask.
4. **Xác nhận kết quả:**
   - Sau khi giao dịch được block xác nhận thành công, hãy tìm hàm `owner()` (mục *Read Contract*) và thực hiện truy vấn.
   - Kiểm tra xem địa chỉ trả về đã chuyển thành địa chỉ của ví Safe Multisig hay chưa.

> **Lưu ý Quan trọng:** Từ thời điểm này trở đi, ví cá nhân Deployer của bạn sẽ **mất quyền** gọi các hàm được bảo vệ bởi modifier `onlyOwner`. Toàn bộ các thao tác quản trị đặc quyền từ nay về sau phải được thực hiện thông qua giao diện của [Safe UI](https://app.safe.global/).
