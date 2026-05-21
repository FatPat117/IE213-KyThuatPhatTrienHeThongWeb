# Hướng dẫn Vận hành và Quản trị qua Safe UI

Sau khi quyền sở hữu (Ownership) của Hợp đồng thông minh đã được chuyển thành công cho ví Safe Multisig, ban quản trị (gồm các ví Owners) sẽ sử dụng giao diện web của Safe để thực hiện các nghiệp vụ quản lý.

## 1. Truy cập và kết nối
1. Truy cập vào [app.safe.global](https://app.safe.global/).
2. Đảm bảo bạn đang chọn đúng mạng blockchain (ví dụ: Sepolia Testnet).
3. Nhấn "Connect wallet" và kết nối bằng ví MetaMask của một trong các Owner có quyền trong Safe.
4. Chọn đúng tài khoản Safe đang được dùng để quản trị dự án.

## 2. Sử dụng Transaction Builder để tương tác
Do Safe không tự biết trước về Hợp đồng thông minh của bạn, chúng ta sẽ dùng ứng dụng **Transaction Builder** được tích hợp sẵn:
1. Tại menu bên trái của Safe, chọn **Apps** -> Tìm và chọn **Transaction Builder**.
2. **Target Address:** Dán địa chỉ của Hợp đồng Gây quỹ.
3. **ABI:** Copy ABI của hợp đồng và dán vào đây (nếu hợp đồng đã Verify trên Etherscan, Safe có thể sẽ tự động tải ABI).
4. Hệ thống sẽ thả xuống danh sách các phương thức (hàm) của hợp đồng mà bạn có thể tương tác.

## 3. Thực hiện các nghiệp vụ chính

### A. Thêm hoặc Xóa Reviewer
1. Chọn hàm `addReviewer` (hoặc `removeReviewer`).
2. Điền địa chỉ ví của nhân sự Reviewer cần thêm/xóa vào ô tham số.
3. Nhấn **Add transaction** (hoặc Create batch nếu muốn nhóm nhiều lệnh lại).

### B. Phê duyệt chiến dịch (Approve Campaign)
1. Chọn hàm thực hiện duyệt (ví dụ: `approveCampaign`).
2. Nhập `campaignId` (mã chiến dịch) cần được phê duyệt.
3. Nhấn **Add transaction**.

## 4. Quy trình xử lý Multisig (Propose → Confirm → Execute)

Sau khi tạo các giao dịch ở bước 3, quy trình phê duyệt sẽ diễn ra như sau:

1. **Propose (Đề xuất):** 
   - Owner khởi tạo giao dịch sẽ nhấn **Create Transaction** (hoặc Send). 
   - Tiến hành ký thông điệp bằng MetaMask (chỉ là ký số off-chain, **không tốn gas**). 
   - Giao dịch này sẽ được đẩy vào hàng đợi (Queue) của Safe.

2. **Confirm (Xác nhận):** 
   - Các Owner khác truy cập vào Safe, mở mục **Transactions** -> **Queue**.
   - Họ sẽ nhìn thấy giao dịch đang chờ xử lý. Nhấn vào giao dịch, chọn **Confirm** và tiến hành ký bằng ví MetaMask của mình.

3. **Execute (Thực thi):** 
   - Khi số lượng chữ ký Confirm đạt ngưỡng yêu cầu (Threshold, ví dụ đủ 2/3 chữ ký), giao dịch đã sẵn sàng.
   - Bất kỳ ai (thường là Owner cuối cùng) có thể nhấn nút **Execute**.
   - Lúc này, một giao dịch thật sự mới được đẩy lên blockchain và người Execute sẽ **phải trả phí gas mạng lưới**.
   - Sau khi giao dịch được block xác nhận, lệnh gọi hàm tới Smart Contract sẽ thành công và trạng thái trên blockchain được thay đổi.
