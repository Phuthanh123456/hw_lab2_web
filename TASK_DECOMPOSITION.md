# Homework 3 — High-Concurrency Flash-Sale E-Commerce Engine

## Hiện trạng ban đầu (đã kiểm tra trước M0)

- Thư mục D:\PhuThanh\Code\hw3_lab3_web tồn tại nhưng đang trống.
- Không có Git repository: git rev-parse không tìm thấy .git; vì vậy hiện chưa có branch, Git status hoặc remote để báo.
- Chưa có framework, package manifest, lockfile, script chạy/test/build, source hay file quy tắc.
- Chưa có TASK_DECOMPOSITION.md, project_rules.md hoặc rules_project.md.
- Tại thời điểm lập kế hoạch, chưa có mã ứng dụng, commit hay push.

## Giả định để lập kế hoạch

Do folder trống nên chưa có framework cần giữ. Đề cần một demo chạy trên trình duyệt cùng test concurrency; M0 dự kiến khởi tạo React + TypeScript + Vite và Vitest. Đây là lựa chọn kế hoạch, chưa cài hoặc tạo project. Nếu khi triển khai phát hiện có source khác, giữ source/framework đó và cập nhật WBS trước khi sửa.

## WBS

### M0 — Khởi tạo tối thiểu
- Mục tiêu: Tạo ứng dụng browser chạy được, lệnh dev/typecheck/test/build và harness kiểm thử.
- File dự kiến: package.json, package-lock.json, .gitignore, index.html, vite.config.ts, tsconfig.json, vitest.config.ts, src/main.tsx, src/App.tsx, src/App.css, src/App.test.tsx, src/vite-env.d.ts, README.md, AI_FAILURE_AUDIT.md.
- Phụ thuộc: Không.
- Hoàn thành khi: Trang demo khởi động; lệnh dev, typecheck, test và production build được định nghĩa; smoke test đạt; chưa có logic countdown, inventory lock hay checkout; AI_FAILURE_AUDIT.md chỉ là mẫu trống, không ghi lỗi giả định.
- Kiểm tra: npm run typecheck; npm test -- --run; npm run build; chạy npm run dev và mở trang.
- Trạng thái: Hoàn thành (2026-10-23).
- Kết quả thực tế: Tạo React + TypeScript + Vite scaffold, trang demo tối thiểu, một smoke test, README, .gitignore và mẫu audit trống. Không có countdown, state machine, checkout hay UI sale hoàn chỉnh. Node.js v24.13.1, npm 11.8.0.
- Kết quả kiểm tra: npm run typecheck đạt; npm test -- --run đạt (1 test file, 1 test); npm run build đạt (TypeScript và Vite production build); npm run dev khởi động thành công và GET http://127.0.0.1:5173/ trả HTTP 200, có title và module entry.
- Commit thực hiện: chore(hw3): prepare flash-sale engine scaffold
### M1 — Contract và đồng hồ có thể kiểm thử
- Mục tiêu: Khai báo kiểu domain cho sale, sản phẩm, inventory, lock, checkout và interface clock có thể thay thế bằng fake clock.
- File dự kiến: src/domain/flash-sale.ts, src/domain/inventory.ts, src/domain/clock.ts và type tests nếu cần.
- Phụ thuộc: M0.
- Hoàn thành khi: Kiểu dữ liệu biểu diễn rõ ID ổn định, số lượng, thời điểm đích, trạng thái lock và trạng thái checkout; không có hành vi ngầm dựa vào UI.
- Kiểm tra: npm run typecheck và type tests cho dữ liệu hợp lệ/không hợp lệ.
- Commit dự kiến: feat: define flash-sale domain contracts

### M2 — Countdown chống trôi

#### M2.1 — Core tính toán thuần
- Mục tiêu: Tính remainingMs từ deadline tuyệt đối; không phụ thuộc UI hoặc scheduler.
- File dự kiến/đã tạo: src/timer/countdown-math.ts, src/timer/__tests__/countdown-math.test.ts.
- Phụ thuộc: M0; core dùng nowMs truyền vào nên không cần contract M1.
- Hoàn thành khi: remainingMs = Math.max(0, targetTimeMs - nowMs); deadline/now phải hữu hạn; duration phải hữu hạn và không âm; duration 0 được phép.
- Kiểm tra và kết quả thực tế: npm run typecheck đạt; npm test -- --run đạt (2 test files, 10 tests), gồm thời gian bình thường, đúng hạn, quá hạn và input không hợp lệ.
- Trạng thái: Hoàn thành (2026-10-23).
- Commit thực hiện: feat(timer): add date-based countdown core

#### M2.2 — Scheduler bằng requestAnimationFrame
- Mục tiêu: Tạo deadline một lần từ Date.now() + durationMs; mỗi frame đọc lại Date.now() và tính remaining từ deadline cố định.
- File dự kiến: src/timer/countdown-scheduler.ts, src/timer/__tests__/countdown-scheduler.test.ts.
- Phụ thuộc: M2.1.
- Hoàn thành khi: Có tối đa một frame đang chờ; stop/cancel idempotent và không phát callback tiếp; hết hạn phát 0 và kết thúc đúng một lần; không dùng setInterval hoặc tích lũy delta frame.
- Kiểm tra: Inject fake clock/RAF; kiểm tra frame trễ, duration 0, frame kết thúc, hủy trước frame và không gọi callback sau hủy.
- Trạng thái: Hoàn thành (2026-10-23).
- Kết quả thực tế: startCountdown chụp deadline một lần từ duration và clock; mỗi frame tính lại bằng deadline trừ Date.now/clock. Dùng RAF adapter có thể inject, giữ tối đa một frame chờ; stop idempotent hủy frame và callback đến muộn bị bỏ qua. Khi remaining về 0, phát tick 0 và onComplete đúng một lần.
- Kết quả kiểm tra: npm run typecheck đạt; npm test -- --run đạt (3 test files, 15 tests), gồm frame trễ, zero duration, hoàn tất, hủy và callback sau hủy; npm run build đạt.
- Commit thực hiện: feat(timer): schedule countdown with animation frames

### M3 — Mô hình Inventory Lock FSM thuần
- Mục tiêu: Định nghĩa model reservation và transition thuần, tường minh giữa active, checked-out và expired.
- File dự kiến/đã tạo: src/inventory/reservation.ts, src/inventory/__tests__/reservation.test.ts.
- Phụ thuộc: M0. Model reservation tự chứa để có thể kiểm thử độc lập; đồng bộ với contract inventory rộng hơn tại M1 khi milestone đó được thực hiện.
- Hoàn thành khi: Reservation có ID ổn định, productId, quantity, expiresAt; active chỉ checkout trước expiresAt và chỉ expire tại/sau expiresAt; transition sai trả lý do từ chối và không đổi state; thời gian nowMs hữu hạn được truyền vào.
- Kiểm tra/kết quả thực tế: npm run typecheck đạt; npm test -- --run đạt (4 test files, 24 tests), gồm tạo active, checkout trước hạn, expire đúng/quá hạn, từ chối checkout đúng hạn, expire sớm, transition từ terminal state, field/time không hợp lệ.
- Trạng thái: Hoàn thành (2026-10-23).
- Commit thực hiện: feat(inventory): model reservation lock states

### M4 — Reservation coordinator và tính nguyên tử trong mô phỏng
- Mục tiêu: Tạo reservation ID ổn định, kiểm tra/trừ tồn kho đồng bộ và điều phối yêu cầu reserve cạnh tranh trong một runtime.
- File dự kiến/đã tạo: src/inventory/inventory-coordinator.ts, src/inventory/__tests__/inventory-coordinator.test.ts.
- Phụ thuộc: M3; model reservation tự chứa, contract inventory rộng hơn tại M1 có thể được đồng bộ sau.
- Hoàn thành khi: Kiểm tra stock và trừ hàng cùng một call stack không có await; stock không âm; có TTL expiresAt và clock/ID generator injectable; hết hạn trả hàng đúng một lần; phạm vi in-memory một runtime được ghi rõ.
- Kiểm tra/kết quả thực tế: npm run typecheck đạt; npm test -- --run đạt (5 test files, 30 tests). Promise.all 40 reserve trên stock 7 cho đúng 7 thành công, 33 thất bại, stock còn 0; test ID/expiry, out-of-stock, product không tồn tại, quantity lỗi, fake clock, expiry trước/đúng hạn và reserve tiếp sau khi hết hạn.
- Trạng thái: Hoàn thành (2026-10-23).
- Commit thực hiện: feat(inventory): reserve stock atomically and expire locks

### M5 — Hết hạn lock và giải phóng đúng một lần
- Mục tiêu: Sweep reservation đến hạn bằng clock truyền vào, chuyển FSM sang expired và trả hàng chính xác một lần.
- File dự kiến/đã tạo: src/inventory/inventory-coordinator.ts, src/inventory/__tests__/inventory-coordinator.test.ts.
- Phụ thuộc: M3, M4. Không tạo timer nền ở milestone này; caller có thể gọi sweep và reserve tự sweep trước khi kiểm tra stock.
- Hoàn thành khi: Trước deadline không expire; tại/quá deadline chuyển expired; sweep lặp không hoàn kho thêm; việc sweep dùng clock injectable, không chờ thời gian thật.
- Kiểm tra/kết quả thực tế: Cùng bộ kiểm tra M4 đạt; fake clock xác nhận chưa hoàn hàng tại 599ms, hoàn hàng tại expiresAt 600ms, các lần sweep sau trả danh sách rỗng và stock giữ nguyên; reserve tiếp theo tự thu hồi reservation hết hạn trước khi xét tồn kho.
- Trạng thái: Hoàn thành (2026-10-23), thực hiện cùng phạm vi service/expiry được yêu cầu.
- Commit thực hiện: feat(inventory): reserve stock atomically and expire locks

### M6 — Checkout và chống xử lý lặp
- Mục tiêu: Hoàn tất checkout từ lock còn hiệu lực, chuyển lượng giữ thành lượng đã bán và chống checkout lặp.
- File dự kiến: src/checkout/checkout-service.ts, src/checkout/__tests__/checkout-service.test.ts, cập nhật domain nếu cần.
- Phụ thuộc: M3, M4, M5.
- Hoàn thành khi: Checkout chỉ thành công từ lock hợp lệ chưa hết hạn; cùng reservation không thể bị trừ kho hai lần; lỗi checkout giữ invariant và trạng thái nhất quán.
- Kiểm tra: Checkout thành công, lock hết hạn, lock sai buyer, gọi lặp/idempotency key, hai checkout tranh cùng lock và stock conservation.
- Commit dự kiến: feat: add idempotent flash-sale checkout

### M7 — Dữ liệu demo Mega-Sale Việt Nam
- Mục tiêu: Chuẩn bị kịch bản 11.11 hoặc Midnight Flash Sale có sản phẩm, tồn kho, giá VND và thời điểm mở bán cấu hình được.
- File dự kiến: src/data/flash-sale-demo.ts, src/data/__tests__/flash-sale-demo.test.ts.
- Phụ thuộc: M1.
- Hoàn thành khi: Dữ liệu demo có ID ổn định, kiểm tra được giới hạn tồn kho/giá/thời điểm; timezone và đơn vị tiền tệ ghi rõ.
- Kiểm tra: Validate fixture, giá hiển thị VND và chuyển đổi thời điểm sale bằng test.
- Commit dự kiến: feat: add Vietnam mega-sale scenario

### M8 — UI demo nối với engine
- Mục tiêu: Hiển thị countdown, sản phẩm, tồn kho, lock, checkout và trạng thái lỗi; gọi service thay vì tự xử lý quy tắc trong component.
- File dự kiến: src/App.tsx, src/components/FlashSalePage.tsx, src/components/ProductCard.tsx, src/components/InventoryStatus.tsx, src/styles/*.
- Phụ thuộc: M2, M4, M5, M6, M7.
- Hoàn thành khi: Có thể quan sát sale trước/đang diễn ra, giữ hàng, hết hạn, checkout và cạnh tranh hàng cuối; trạng thái UI khớp engine.
- Kiểm tra: Component tests và browser smoke test cho các trạng thái mở sale, giữ, hết hạn, checkout, lỗi; kiểm tra không có timer chạy nền sau unmount.
- Commit dự kiến: feat: build flash-sale demo interface

### M9 — Khả năng dùng và quan sát trạng thái
- Mục tiêu: Làm rõ trạng thái sale/lock/checkout, thông báo lỗi và thao tác bàn phím trong demo.
- File dự kiến: src/components/*, src/styles/*, src/App.test.tsx, docs/verification.md nếu cần.
- Phụ thuộc: M8.
- Hoàn thành khi: Control có nhãn, focus nhìn thấy; trạng thái không chỉ phân biệt bằng màu; giao diện dùng được ở viewport hẹp; thông báo không gây cập nhật UI liên tục ngoài nhu cầu.
- Kiểm tra: Keyboard smoke test, viewport hẹp, accessibility tree/audit đang có trong project; ghi rõ công cụ và kết quả thực tế.
- Commit dự kiến: feat: improve sale demo accessibility

### M10 — AI Failure Audit có bằng chứng
- Mục tiêu: Ghi ít nhất ba lỗi thực sự do AI tạo hoặc đề xuất và đã được xác minh, gồm bằng chứng, cách phát hiện, cách sửa và kiểm tra xác nhận.
- File dự kiến: AI_FAILURE_AUDIT.md; liên kết tới test/log/commit liên quan nếu có.
- Phụ thuộc: M2–M9 và bằng chứng phát sinh trong quá trình làm.
- Hoàn thành khi: Có ít nhất 3 mục riêng biệt; mỗi mục chỉ ra lỗi cụ thể, bằng chứng tái kiểm tra được, phương pháp phát hiện, bản sửa và kết quả test. Không tính giả thuyết, code chưa chạy hoặc lỗi được dựng giả.
- Kiểm tra: Mỗi mục audit truy được tới diff/test/log và lặp lại được cách xác nhận; rà soát để không ghi lộ secret.
- Commit dự kiến: docs: record verified AI implementation failures

### M11 — Tích hợp, kiểm thử cạnh tranh và bàn giao
- Mục tiêu: Xác minh luồng sale đầu-cuối, invariants, kiểm thử, scripts và lịch sử commit.
- File dự kiến: test/integration/*, README.md, TASK_DECOMPOSITION.md, docs/verification.md; cập nhật code chỉ nếu lỗi được tái hiện.
- Phụ thuộc: M0–M10.
- Hoàn thành khi: Typecheck, toàn bộ test và production build đạt; luồng countdown → reserve → expire/checkout không oversell; ít nhất 8 commit triển khai riêng theo Conventional Commits; WBS ghi đúng kết quả và phần chưa xác minh.
- Kiểm tra: npm run typecheck; npm test -- --run; npm run build; test integration có fake clock và concurrent buyers; kiểm tra git log, git status và rà soát file chuẩn bị commit. Không push trong các bước milestone.
- Commit dự kiến: test: verify flash-sale concurrency end to end

## Kế hoạch commit

M0–M11 hiện dự kiến gồm 12 commit: M2 được tách thành hai commit (core và scheduler), còn M4/M5 được hoàn tất cùng một commit theo phạm vi được yêu cầu rõ ràng. M0, M2.1, M2.2, M3, M4 và M5 đã hoàn thành bằng các commit ghi tại từng milestone. M1 và M6–M11 còn chờ yêu cầu và kiểm tra từng milestone. Các phần còn lại sẽ tiếp tục theo từng milestone. Hiện chưa cấu hình remote và chưa push.
