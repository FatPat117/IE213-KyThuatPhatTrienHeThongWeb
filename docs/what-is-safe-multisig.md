# Tìm hiểu về Ví Safe Multisig và Ứng dụng trong dự án

## 1. Ví Multisig (Đa chữ ký) là gì?
Multisig (Multi-signature) là một loại ví tiền điện tử hoặc hợp đồng thông minh yêu cầu phải có nhiều hơn một chữ ký (hoặc sự phê duyệt) để thực hiện một giao dịch. 
Điều này giống như một tài khoản ngân hàng chung, nơi cần có sự đồng ý của nhiều thành viên quản trị trước khi có thể rút tiền hoặc thay đổi cấu hình quan trọng.

**Lợi ích:**
- **Bảo mật cao:** Tránh việc một cá nhân (single point of failure) bị lộ private key dẫn đến mất tài sản hoặc quyền kiểm soát hệ thống.
- **Tính phi tập trung:** Quyền quyết định được chia đều cho các thành viên trong ban quản trị.

**Safe (trước đây là Gnosis Safe):** Là nền tảng tiêu chuẩn và phổ biến nhất trên blockchain để tạo và quản lý ví multisig.

## 2. Cách tạo ví Multisig trên Safe (app.safe.global)

1. **Truy cập:** Vào trang [app.safe.global](https://app.safe.global/).
2. **Kết nối ví:** Nhấn "Connect wallet" ở góc trên bên phải và kết nối với ví MetaMask của bạn.
3. **Chọn mạng:** Chuyển sang mạng blockchain dự án đang dùng, ví dụ **Sepolia**.
4. **Tạo Safe mới:**
   - Nhấn **Create new Account** (hoặc **Create Safe**).
   - Đặt tên cho Safe của bạn để dễ phân biệt.
   - **Thêm Owner (Chủ sở hữu):** Điền tên và địa chỉ ví của các thành viên trong nhóm quản trị (ví dụ: thêm 3 hoặc 5 địa chỉ ví).
   - **Thiết lập Threshold (Ngưỡng xác nhận):** Chọn số lượng xác nhận tối thiểu cần thiết để thực thi giao dịch (ví dụ: 2/3 - cần ít nhất 2 trong 3 owner đồng ý).
5. **Xác nhận & Khởi tạo:** Kiểm tra lại thông tin và ký xác nhận giao dịch tạo Safe trên MetaMask. (Lưu ý: Quá trình này sẽ tốn một ít phí gas của mạng lưới).
6. **Hoàn tất:** Sau khi giao dịch thành công, bạn sẽ nhận được một địa chỉ ví Safe (ví dụ bắt đầu bằng `sep:0x...` trên Sepolia). Đây chính là địa chỉ Admin của hệ thống.

## 3. Cách Multisig được sử dụng trong hệ thống Gây quỹ

Trong hệ thống của dự án, **quyền sở hữu (ownership)** của Hợp đồng thông minh (Smart Contract) chính sẽ được giao cho một ví Safe Multisig, thay vì một cá nhân duy nhất.

Ví Safe này sẽ đóng vai trò là **Ban Quản trị hệ thống**, với các quyền hạn đặc quyền:
- Phê duyệt (Approve) các chiến dịch gây quỹ hợp lệ để hiển thị lên nền tảng.
- Thêm hoặc xóa các địa chỉ ví Reviewer (người kiểm duyệt cấp thấp hơn).
- Thay đổi các cấu hình cốt lõi của hợp đồng (như phí nền tảng, thời hạn...).
- Xử lý các tình huống khẩn cấp, tạm dừng hoạt động hợp đồng.

Với cơ chế này, bất kỳ thao tác thay đổi nào lên hệ thống đều yêu cầu một Owner khởi tạo giao dịch (Propose), sau đó các Owner khác vào kiểm tra và xác nhận (Confirm). Giao dịch chỉ được lưu lên blockchain (Execute) khi đủ số lượng chữ ký theo thiết lập Threshold. Đảm bảo tính minh bạch và an toàn cho toàn bộ dự án.
