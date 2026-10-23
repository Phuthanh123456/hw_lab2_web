# Quy tắc dự án HW3

- Mỗi lần chỉ triển khai một milestone được yêu cầu; không làm one-shot và không refactor ngoài phạm vi milestone.
- Trước khi sửa, kiểm tra Git status và đọc file liên quan; giữ nguyên thay đổi chưa commit.
- Giữ framework hiện có nếu xuất hiện; hiện folder được kiểm tra đang trống. Không khởi tạo ứng dụng cho tới khi được yêu cầu milestone.
- Countdown luôn tính từ Date.now() và target timestamp ở mỗi tick; không giảm remaining bằng setInterval.
- Inventory lock phải qua finite state machine tường minh; giữ invariant tồn kho trong mọi thao tác đồng thời.
- Chạy kiểm tra của milestone trước khi commit. Một milestone đạt thì một commit riêng Conventional Commits; không gộp milestone.
- Không push GitHub trong các bước HW3 hiện tại.
- AI_FAILURE_AUDIT.md chỉ ghi lỗi AI có bằng chứng và đã kiểm chứng. Mỗi mục cần bằng chứng, cách phát hiện, cách sửa và kiểm tra xác nhận; tuyệt đối không bịa lỗi hoặc tạo lỗi giả để đủ số lượng.
