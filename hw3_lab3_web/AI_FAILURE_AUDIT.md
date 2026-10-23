# AI Failure Audit — HW3

## Phạm vi và kết quả

Ba lỗi dưới đây phát sinh trong quá trình AI soạn test/tài liệu cho các milestone. Hai lỗi test được phát hiện khi chạy test và đã sửa trước khi commit; lỗi tài liệu được phát hiện bằng cách đối chiếu Git history với API checkout. Không có lỗi nào được thêm vào code sản phẩm để tạo minh chứng. Các đoạn sai tạm thời ở mục 1 và 2 không còn trong Git history; dấu vết là kết quả chạy test được ghi lại trong hội thoại của milestone, còn bản sửa và kiểm tra hồi quy có thể xem trong repository hiện tại.

## Failure 1 — Test terminal state khởi tạo reservation ở trạng thái active

- **Prompt/ngữ cảnh AI:** Yêu cầu M3: “Thêm test cho các transition hợp lệ và không hợp lệ”, gồm transition từ trạng thái terminal.
- **Đầu ra AI sai:** Bản nháp helper dùng `overrides: Partial<Reservation>` rồi truyền spread các override vào `createReservation(...)`. Trường hợp gọi helper với `status: 'checked-out'` hoặc `status: 'expired'` không giữ được trạng thái đó.
- **Bằng chứng/diễn biến quan sát:** `createReservation` luôn trả về `{ ...input, status: 'active' }` trong `src/inventory/reservation.ts`. Test terminal-state của bản nháp thất bại vì transition được chấp nhận: đối tượng tưởng là terminal thực tế vẫn active. Bản nháp và lỗi chạy được ghi trong kết quả M3 của hội thoại; chúng không được commit.
- **Vì sao sai/ảnh hưởng:** Factory có chủ đích chỉ tạo reservation active. Helper làm mất trạng thái terminal, nên test không kiểm tra transition cần kiểm tra và báo lỗi sai về FSM.
- **Cách phát hiện:** Chạy test transition terminal ở M3; trạng thái nhận được từ factory không khớp trạng thái đầu vào mong muốn.
- **Cách sửa:** Bỏ `status` khỏi kiểu override và dựng trạng thái terminal riêng sau khi tạo reservation. Bản sửa hiện tại ở `src/inventory/__tests__/reservation.test.ts:8-10,72-80` dùng `Partial<Omit<Reservation, 'status'>>` rồi tạo `{ ...reservation(), status }`.
- **Kiểm tra hồi quy:** `npm test -- --run src/inventory/__tests__/reservation.test.ts` — đạt, 1 file / 9 tests (2026-10-23). Test terminal-state xác nhận trạng thái checked-out/expired bị từ chối.

## Failure 2 — Kỳ vọng sai định dạng countdown trong test giao diện

- **Prompt/ngữ cảnh AI:** Yêu cầu M8 muốn countdown hiển thị mili giây và kiểm tra luồng demo.
- **Đầu ra AI sai:** Bản nháp test kỳ vọng chuỗi `05:00:00.000` lúc bắt đầu và `04:59:59.679` sau frame trễ.
- **Bằng chứng/diễn biến quan sát:** Lần chạy test M8 báo giá trị thực tế lần lượt là `00:05:00.000` và `00:04:59.679`. Formatter dùng định dạng `HH:MM:SS.mmm`; 5 phút phải nằm ở phần phút, không phải phần giờ. Các kỳ vọng sai được sửa trước commit M8 và giá trị đúng còn trong `src/App.test.tsx:34-37,52-55`; kết quả thất bại ban đầu nằm trong output test của hội thoại M8.
- **Vì sao sai/ảnh hưởng:** Test mô tả sai định dạng của UI và làm build kiểm thử thất bại dù countdown đúng; nếu nới lỏng kiểm tra để vượt qua, lỗi định dạng thật có thể bị che.
- **Cách phát hiện:** Vitest so sánh chuỗi kỳ vọng với nội dung DOM, cho thấy chênh lệch ở giờ/phút.
- **Cách sửa:** Đổi kỳ vọng sang `00:05:00.000` và `00:04:59.679`, giữ assertion chính xác cho frame trễ.
- **Kiểm tra hồi quy:** `npm test -- --run src/App.test.tsx` — đạt, 1 file / 8 tests (2026-10-23).

## Failure 3 — README không được cập nhật khi checkout được thêm

- **Prompt/ngữ cảnh AI:** Yêu cầu M6: “Chỉ triển khai checkout cho reservation hiện có.”
- **Đầu ra AI sai:** Sau khi thêm checkout, README tại `adce3ca` vẫn ghi “checkout and the complete sale workflow are not implemented yet.” Commit `adce3ca` thêm `InventoryCoordinator.checkout()` nhưng không cập nhật README.
- **Vì sao sai/ảnh hưởng:** Tài liệu mô tả sai trạng thái ứng dụng, khiến người đọc có thể nghĩ checkout chưa tồn tại dù API và test checkout đã có.
- **Cách phát hiện:** `git show adce3ca:README.md` xác nhận câu cũ còn nguyên sau khi checkout được thêm; `git show adce3ca -- src/inventory/inventory-coordinator.ts` cho thấy API mới.
- **Cách sửa:** README được cập nhật ở commit `8fb8e70`; phiên bản hiện tại tại `README.md:3` nêu rõ demo có checkout và không kết nối payment thật.
- **Kiểm tra hồi quy:** Đối chiếu lại README hiện tại với `InventoryCoordinator.checkout()` và test checkout; nội dung giờ khớp. `npm run typecheck`, toàn bộ `npm test -- --run` và `npm run build` đều đạt ở trạng thái hiện tại. Dự án chưa có test tự động kiểm tra tính nhất quán của README; bước đối chiếu này là kiểm tra thủ công.

## Tổng kết xác minh

- Số lỗi AI có bằng chứng đã xác minh: **3**.
- Mục 1 và 2 là lỗi trong test draft, không phải lỗi còn tồn tại trong code sản phẩm.
- Mục 3 là lỗi tài liệu lịch sử, đã sửa trong commit `8fb8e70`.
- Không khẳng định đã dùng memory profiler hoặc công cụ ngoài những lệnh/test được nêu ở trên.
