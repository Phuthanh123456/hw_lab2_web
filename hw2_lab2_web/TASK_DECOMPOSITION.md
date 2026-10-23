# Homework 2 — Concurrent FIFO Audio Visualizer Queue Engine

## Hiện trạng

Thư mục dự án ban đầu trống, chưa có Git repository hoặc framework. Milestone khởi tạo dùng Vite + TypeScript thuần để tạo trang demo chạy trên trình duyệt; chưa cài đặt queue, Web Audio API hay visualizer.

## Các milestone

### M0 — Khởi tạo dự án

**Task 0.1 — Tạo bộ khung TypeScript chạy trên trình duyệt**
- **Mục tiêu:** Tạo trang demo tối thiểu, entry point và lệnh phát triển/build.
- **File dự kiến:** `.gitignore`, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `src/main.ts`, `src/style.css`, `README.md`.
- **Phụ thuộc:** Không.
- **Tiêu chí hoàn thành:** Chạy được trang demo bằng Vite; TypeScript compile strict; có build production; chưa có queue, AudioContext, AnalyserNode hoặc animation visualizer.
- **Cách kiểm tra:** `npm run typecheck`, `npm run build`; chạy `npm run dev -- --host 127.0.0.1` và xác nhận trang trả nội dung tại localhost.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả kiểm tra:** Thư mục ban đầu trống; đã tạo Vite + TypeScript thuần và trang overview tĩnh, không có queue/audio/visualizer. Node `v24.13.1`, npm `11.8.0`, Vite `8.3.5`; `npm install --save-dev vite typescript @types/node` hoàn tất với 0 vulnerability. `npm run typecheck` đạt sau khi khai báo `vite/client`; `npm run build` đạt. Dev server tại `http://127.0.0.1:5173/` trả HTTP 200 và HTML có module entry `/src/main.ts`. Dev server đã dừng sau kiểm tra.

### M1 — Contract và harness kiểm thử

**Task 1.1 — Định nghĩa kiểu task và chính sách FIFO**
- **Mục tiêu:** Chốt kiểu dữ liệu và hành vi queue: thứ tự FIFO, giới hạn worker, trạng thái task, cancellation và kết quả lỗi.
- **File dự kiến:** `src/audio/audio-task.ts`, `src/audio/queue-types.ts`, `docs/queue-contract.md`.
- **Phụ thuộc:** Task 0.1.
- **Tiêu chí hoàn thành:** Contract mô tả rõ trạng thái queued/running/completed/failed/cancelled, cách xử lý task hủy khi đang chờ/đang chạy, và bảo đảm task sau vẫn chạy nếu task trước lỗi.
- **Cách kiểm tra:** Typecheck; rà bảng chuyển trạng thái và ví dụ enqueue/cancel theo contract.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** Định nghĩa `AudioTask`, `AudioTaskStatus`, `AudioTaskError`, branded `AudioTaskId`, `AudioTaskHandle` và API `AudioTaskQueue` cho enqueue/cancel/snapshot/subscribe/forget. Queue sở hữu `AbortController`, task snapshot chỉ lộ `AbortSignal`; contract ghi rõ FIFO, chuyển trạng thái và retention. `npm run typecheck` đạt. Chưa thêm implementation.

**Task 1.2 — Chuẩn bị test runner và tiện ích đồng bộ bất đồng bộ**
- **Mục tiêu:** Tạo kiểm thử đơn vị cho các trường hợp queue cạnh tranh có thể lặp lại ổn định.
- **File dự kiến:** `package.json`, `package-lock.json`, `vitest.config.ts`, `tsconfig.node.json`, `src/audio/__tests__/deferred.ts`, `src/audio/__tests__/deferred.test.ts`.
- **Phụ thuộc:** Task 1.1.
- **Tiêu chí hoàn thành:** Có lệnh test; deferred promise/fake timer hỗ trợ xác nhận thứ tự và cancellation không phụ thuộc thời gian thực.
- **Cách kiểm tra:** `npm test -- --run` chạy được với test harness cơ bản.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** Đã thêm Vitest 5.0.5, lệnh `npm test`, helper deferred và test resolve/reject. `npm run typecheck` đạt; `npm test -- --run` đạt (1 file, 2 test).

### M2 — FIFO queue và cancellation

**Task 2.1 — Cài đặt hàng đợi tuần tự cho tác vụ async**
- **Mục tiêu:** Xử lý tác vụ theo FIFO, chống chạy lặp worker, bảo đảm lỗi task không kẹt hàng đợi.
- **File dự kiến:** `src/audio/AudioTaskQueue.ts`, `src/audio/__tests__/AudioTaskQueue.test.ts`.
- **Phụ thuộc:** Task 1.1, 1.2.
- **Tiêu chí hoàn thành:** Enqueue nhiều task đồng thời vẫn giữ thứ tự; chỉ số worker đang chạy tuân theo chính sách đã chốt; resolve/reject task chính xác; queue tiếp tục sau lỗi.
- **Cách kiểm tra:** Unit test enqueue cùng tick, task async được trì hoãn, lỗi giữa queue và enqueue trong lúc worker chạy.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** `FifoAudioTaskQueue` dùng một promise worker và FIFO pending list; task bị shift khỏi pending trước khi chạy. Fetch mock với độ trễ 30/8/1 ms xác nhận thứ tự start/completion không bị đảo; network/HTTP failure không chặn task kế tiếp; snapshot/subscribe và forget được kiểm tra. `npm run typecheck`, `npm test -- --run` (3 file, 10 test tổng) và `npm run build` đạt.

**Task 2.2 — Hủy task bằng AbortController**
- **Mục tiêu:** Cung cấp hủy task chờ hoặc đang chạy, không để tín hiệu hủy làm treo worker.
- **File dự kiến:** `src/audio/AudioTaskQueue.ts`, `src/audio/__tests__/AudioTaskQueue.test.ts`.
- **Phụ thuộc:** Task 2.1.
- **Tiêu chí hoàn thành:** Mỗi task có signal riêng; task đã hủy không bắt đầu hoặc công bố kết quả; task đang chạy nhận abort; hủy lặp/reentrant không tạo chuyển trạng thái sai; FIFO được giữ khi enqueue đồng thời; lỗi/hủy không chặn task kế tiếp.
- **Cách kiểm tra:** Unit test hủy queued, trong fetch và decode; hủy lặp lại; hủy đồng bộ khi phát trạng thái `running`; burst 32 enqueue; lỗi fetch/decode và xác nhận tác vụ tiếp theo hoàn tất.
- **Trạng thái:** Hoàn thành và rà soát cancellation/concurrency (2026-10-23).
- **Kết quả:** Hủy task chờ gỡ nó khỏi pending; hủy lúc fetch abort signal và race loader để worker tiếp tục kể cả loader không phản hồi signal. Worker kiểm tra lại signal sau sự kiện `running`, trước I/O và sau fetch/decode. Vì decode không hỗ trợ abort, worker chờ decode settle rồi bỏ buffer nếu task đã hủy; handle của task đó đã reject và không công bố buffer. Test xác nhận hủy lặp không phát chuyển trạng thái terminal lần hai, hủy queued/fetch/decode an toàn, 32 enqueue giữ FIFO và lỗi không dừng queue. Typecheck đạt; 3 test files/17 tests đạt; production build đạt.

### M3 — Tải track và giải mã AudioBuffer

**Task 3.1 — Tải dữ liệu audio có thể hủy (fetch-only)**
- **Mục tiêu:** Dùng `fetch` với `AbortSignal`, kiểm tra HTTP response và trả về `ArrayBuffer`.
- **File dự kiến:** `src/audio/audio-loader.ts`, `src/audio/__tests__/audio-loader.test.ts`.
- **Phụ thuộc:** Task 2.2.
- **Tiêu chí hoàn thành:** Phân biệt lỗi mạng và HTTP; cancellation được truyền tới fetch; lỗi/hủy của một task không chặn task sau. Chưa giải mã audio.
- **Cách kiểm tra:** Fetch mock với độ trễ khác nhau để xác minh FIFO; kiểm tra thành công, lỗi mạng, HTTP lỗi và abort khi fetch đang chạy.
- **Trạng thái:** Hoàn thành phần fetch-only (2026-10-23); giải mã vẫn thuộc Task 3.2.
- **Kết quả:** `createAudioDataLoader` truyền đúng AbortSignal, trả `ArrayBuffer` cho HTTP success và chuẩn hóa lỗi mạng/HTTP. Có unit test success, lỗi mạng, HTTP; queue tests kiểm tra abort và xử lý thứ tự. Không gọi `decodeAudioData`.

**Task 3.2 — Giải mã dữ liệu thành AudioBuffer**
- **Mục tiêu:** Giải mã `ArrayBuffer` bằng `AudioContext.decodeAudioData` sau khi Task 3.1 hoàn tất.
- **File dự kiến:** `src/audio/AudioTaskQueue.ts`, `src/audio/audio-task.ts`, `src/audio/queue-types.ts`, `src/audio/__tests__/AudioTaskQueue.test.ts`.
- **Phụ thuộc:** Task 3.1.
- **Tiêu chí hoàn thành:** Queue giải mã dữ liệu đã tải bằng một `AudioContext` dùng chung; handle chỉ resolve `AudioBuffer` sau khi decode thành công; lỗi decode được chuẩn hóa; hủy trước decode không khởi tạo decode và hủy khi decode đang chạy làm bỏ kết quả; tham chiếu tạm thời được xóa; `dispose()` đóng context một lần.
- **Cách kiểm tra:** `npm run typecheck`, `npm test -- --run`, `npm run build`; mock `decodeAudioData` cho success/failure, hủy trước/sau khi decode bắt đầu và đóng context.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** `FifoAudioTaskQueue` trả `Promise<AudioBuffer>`, tạo lười hoặc nhận một `AudioContext` dùng chung, đánh dấu completed sau decode và chỉ đóng context khi `dispose()`. Nếu hủy trong decode, worker chờ thao tác decode vốn không hỗ trợ AbortSignal kết thúc rồi bỏ buffer; không lưu buffer/ArrayBuffer trên task record. Typecheck đạt; 3 test files/15 tests đạt; production build đạt.

### M4 — Playback và thu hồi tài nguyên audio

**Task 4.1 — Quản lý AudioBufferSourceNode và playback lifecycle**
- **Mục tiêu:** Phát/dừng buffer và dọn source node, listener, timer, kết nối khi kết thúc, thay track hoặc dispose.
- **File dự kiến:** `src/audio/AudioTaskQueue.ts`, `src/audio/queue-types.ts`, `src/audio/audio-playback.ts`, `src/audio/__tests__/audio-playback.test.ts`.
- **Phụ thuộc:** Task 3.2.
- **Tiêu chí hoàn thành:** Source node mới được tạo cho mỗi lần phát; kết nối source → AnalyserNode → destination; signal của task hủy ngăn phát hoặc dừng source; kết thúc/stop giải phóng node và listener; dispose dừng mọi source và ngắt analyser mà không đóng AudioContext dùng chung.
- **Cách kiểm tra:** Fake AudioContext/source xác nhận play, `ended`, stop, task signal abort, stop exception đã dừng và dispose lặp lại; `npm run typecheck`, `npm test -- --run`, `npm run build`.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** `AudioPlayback` dùng AudioContext chung do queue cung cấp, tạo một AnalyserNode nối tới destination và source mới cho mỗi lần play. Signal hủy được theo dõi; source được stop/disconnect, gỡ listener và xóa khỏi active map khi abort, stop hoặc `ended`. `dispose()` dọn mọi source/analyser; queue vẫn là nơi sở hữu và đóng AudioContext. Typecheck đạt; 4 test files/22 tests đạt; production build đạt.

### M5 — Web Audio analyser và FFT

**Task 5.1 — Kết nối AnalyserNode với playback graph**
- **Mục tiêu:** Dùng AnalyserNode dùng chung trong playback graph và cấu hình đúng `fftSize` cho 256 hoặc 512 frequency bins.
- **File dự kiến:** `src/audio/audio-playback.ts`, `src/visualizer/AudioVisualizer.ts`, `src/visualizer/__tests__/AudioVisualizer.test.ts`.
- **Phụ thuộc:** Task 4.1.
- **Tiêu chí hoàn thành:** Playback tạo một AnalyserNode nối tới destination; cấu hình `fftSize` sao cho `frequencyBinCount = fftSize / 2`; visualizer tái sử dụng node này; dispose ngắt node còn AudioContext do queue sở hữu.
- **Cách kiểm tra:** Unit test graph playback và cấu hình 256/512 bins; kiểm tra `getByteFrequencyData` nhận đúng cỡ buffer.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** `AudioPlayback` tạo AnalyserNode dùng chung cho source và visualizer. Visualizer đặt `fftSize = 2 * frequencyBinCount` và xác nhận kích thước API trả về. 256/512 bins được unit test; analyser disconnect trong playback dispose, AudioContext đóng bởi queue.

### M6 — Visualizer theo requestAnimationFrame

**Task 6.1 — Vẽ frequency data trên Canvas/SVG**
- **Mục tiêu:** Hiển thị dữ liệu analyser bằng `requestAnimationFrame`, không cập nhật framework state mỗi frame.
- **File dự kiến:** `src/visualizer/AudioVisualizer.ts`, `src/visualizer/__tests__/AudioVisualizer.test.ts`.
- **Phụ thuộc:** Task 5.1.
- **Tiêu chí hoàn thành:** Vẽ frequency data bằng RAF; mỗi frame dùng lại `Uint8Array` và Canvas context; chỉ có một loop; stop/dispose hủy frame và listener; tab ẩn tạm dừng, tab hiện tiếp tục.
- **Cách kiểm tra:** Fake RAF xác nhận start lặp không nhân loop, buffer dùng lại, stop/dispose cancel frame, visibility pause/resume và bin count 256/512.
- **Trạng thái:** Hoàn thành (2026-10-23).
- **Kết quả:** `AudioVisualizer` vẽ các bin trực tiếp lên canvas theo RAF, không có framework state. Canvas context và `Uint8Array` được tạo một lần; loop được giữ đơn nhất và dừng khi ẩn/stop/dispose, rồi tiếp tục khi hiện lại. Typecheck đạt; 5 test files/27 tests đạt; production build đạt.

### M7 — Trang demo tích hợp và điều khiển

**Task 7.1 — Tích hợp queue, tải track, playback và visualizer**
- **Mục tiêu:** Tạo demo để thêm nhiều URL track, xem FIFO status, hủy task, phát/dừng track và quan sát tần số.
- **File dự kiến:** `src/ui/AudioQueueDemo.ts`, `src/main.ts`, `src/style.css`, `src/audio/audio-playback.ts`, `src/audio/__tests__/audio-playback.test.ts`.
- **Phụ thuộc:** Task 2.2, 3.2, 4.1, 5.1, 6.1.
- **Tiêu chí hoàn thành:** UI dùng API engine để enqueue/cancel, phản ánh trạng thái queue/error, phát buffer đã decode và dừng playback; có label cho input/button và chọn 256/512 bins; xóa task terminal giải phóng buffer; teardown gọi dispose engine.
- **Cách kiểm tra:** `npm run typecheck`, `npm test -- --run`, `npm run build`; kiểm tra thủ công luồng enqueue/cancel/play/stop, error và đổi bins trên trình duyệt.
- **Trạng thái:** Hoàn thành phần giao diện demo tối thiểu (2026-10-23).
- **Kết quả:** `AudioQueueDemo` quan sát `FifoAudioTaskQueue` snapshot, hiển thị queued/loading-decoding/ready/playing/error/cancelled, gắn rejection handler cho từng handle và xóa buffer khỏi view model khi fail/cancel/remove/teardown. Nút play dùng `AudioPlayback`; callback ended/stop đồng bộ trạng thái UI; select bins cấu hình visualizer hiện có. Engine được dispose khi `pagehide` hoặc HMR dispose. Running chỉ hiển thị chung loading/decoding vì contract hiện tại không phân biệt hai pha. Typecheck đạt; 5 test files/27 tests đạt; production build đạt.

**Task 7.2 — Accessibility và responsive cho demo**
- **Mục tiêu:** Dùng được bằng bàn phím và screen reader; layout không vỡ ở màn hình hẹp.
- **File dự kiến:** `src/ui/*.ts`, `src/style.css`, `docs/accessibility-checklist.md`.
- **Phụ thuộc:** Task 7.1.
- **Tiêu chí hoàn thành:** Control có label, focus nhìn thấy, queue status được công bố phù hợp, độ tương phản đạt WCAG 2.2 AA, không tràn ngang ngoài vùng chủ ý.
- **Cách kiểm tra:** Typecheck/build, accessibility tree/audit hiện có, bàn phím và viewport hẹp.

### M8 — Tích hợp cuối và bàn giao

**Task 8.1 — Kiểm tra concurrency, hủy và cleanup đầu-cuối**
- **Mục tiêu:** Xác nhận queue không kẹt hoặc chạy sai thứ tự, cancellation không để task ma, audio nodes/listeners/RAF đều được dọn.
- **File dự kiến:** `src/audio/__tests__/*`, `src/visualizer/__tests__/*`, `docs/verification.md`.
- **Phụ thuộc:** Tasks 2.1–7.2.
- **Tiêu chí hoàn thành:** Bộ kiểm thử và browser flow bao phủ enqueue đồng thời, abort mọi giai đoạn, lỗi fetch/decode, stop/unmount; không còn lỗi console hoặc tài nguyên còn hoạt động sau cleanup.
- **Cách kiểm tra:** `npm test -- --run`, `npm run typecheck`, `npm run build`, browser verification và rà thủ công cleanup.
- **Kết quả audit memory/performance (2026-10-23; chưa hoàn tất toàn bộ Task 8.1):** `AudioBufferSourceNode` được disconnect và đặt `buffer = null` sau ended/stop; app dispose dừng mọi source, giải phóng buffer view model, rồi queue dispose đóng context và xóa snapshots/listeners. Thêm Remove cho task terminal để gọi `forget()` và nhả buffer. Queue đã null controller/resolvers ở trạng thái terminal; dispose xóa record và listener. Visualizer chỉ có một RAF và một visibility listener theo instance; stop/hidden/dispose cancel frame, không cập nhật framework state theo frame. UI bắt rejection của result và cleanup; kiểm thử dưới `--unhandled-rejections=strict` không phát hiện rejection không xử lý. `npm run typecheck`, 5 test files/30 tests và production build đạt. Chỉ dùng code review và mock/unit tests; chưa dùng memory profiler hoặc xác minh thủ công trên browser.

## Quy tắc chuyển milestone

Chỉ bắt đầu milestone được yêu cầu; không triển khai trước task phụ thuộc. Cuối mỗi task ghi lại file đã sửa và kết quả kiểm tra tại đây. Không commit nếu chưa được yêu cầu.
