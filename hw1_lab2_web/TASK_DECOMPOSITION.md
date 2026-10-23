# Homework 1 — Production Enterprise Data-Grid (WCAG 2.2 AA)

## Hiện trạng và nguyên tắc

Workspace ban đầu không có project files hoặc quy tắc dự án. `project_rules.md` giữ phạm vi từng task nhỏ và yêu cầu kiểm tra trước commit. M2/M3 đã có các commit milestone riêng. Production build được đo bằng Lighthouse 13.5.0 trên Chrome 155 headless desktop: Accessibility 100/100 và Best Practices 100/100; browser flow, Chrome Accessibility tree và viewport 320px đã được kiểm tra. Kiểm tra zoom 200–400% và screen reader thực tế vẫn cần người dùng xác minh.

Các đường dẫn trong mục “File dự kiến” cho task sau là mục tiêu triển khai. Project hiện dùng React + TypeScript với Vite; contract TypeScript đã được khai báo ở Task 1.1.

## WBS

### M0 — Nền tảng chạy được

**Task 0.1 — Chốt stack và cấu hình tối thiểu**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Khởi tạo project TypeScript và một trang tối giản để có thể phát triển, build và mở DataGrid độc lập.
- **File dự kiến:** `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/components/ScaffoldStatus.tsx`, `README.md`.
- **Phụ thuộc:** Không.
- **Hoàn thành khi:** React + TypeScript + Vite được cấu hình; lệnh `dev`, `typecheck`, `build`, `preview` có trong `package.json` và README; trang demo có component riêng; chưa có logic DataGrid.
- **Cách kiểm tra và kết quả:** Node `v24.13.1`, npm `11.8.0`; `npm install` thành công (26 packages, 0 vulnerabilities); `npm run typecheck` thành công; `npm run build` thành công với Vite `8.3.5`; `npm run dev -- --host 127.0.0.1 --port 5173` khởi động được và trang trả HTML qua HTTP. Không kiểm tra giao diện bằng GUI.

**Task 0.2 — Tạo dữ liệu mẫu có kiểu rõ ràng**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Chuẩn bị một tập dữ liệu nhỏ nhưng đủ đa dạng để thấy rõ sort, filter, pagination và chọn hàng.
- **File dự kiến:** `src/data/sample-data.ts`.
- **Phụ thuộc:** Task 0.1.
- **Hoàn thành khi:** Dữ liệu có đủ hàng để qua nhiều trang; các cột có kiểu và giá trị rỗng/khác nhau được kiểm soát; không phụ thuộc dịch vụ ngoài.
- **Cách kiểm tra và kết quả:** `npm run typecheck` và `npm run build` thành công; rà soát 12 hồ sơ với nhiều phòng ban, văn phòng, loại hợp đồng, trạng thái và giá trị số để có thể thử lọc, sắp xếp và phân trang.

### M1 — Contract và cấu trúc bảng ngữ nghĩa

**Task 1.1 — Khai báo contract TypeScript**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Khai báo đúng API generic theo đề.
- **File dự kiến:** `src/components/data-grid/data-grid-contract.ts`, `src/components/data-grid/data-grid-contract.typecheck.ts`.
- **Phụ thuộc:** Task 0.1.
- **Hoàn thành khi:** Có `ColumnDef<T>` với `header: string`, `accessorKey: keyof T`, `sortable?: boolean`; `DataGridProps<T>` với `data: T[]`, `columns: ColumnDef<T>[]`, `onRowSelect?: (item: T) => void`, `ariaLabel: string`.
- **Cách kiểm tra và kết quả:** `npm run typecheck` thành công với kiểu mẫu `EmployeeRecord`; key hợp lệ được chấp nhận và `accessorKey: 'email'` bị TypeScript từ chối qua `@ts-expect-error`. Đối chiếu tên/kiểu từng field với contract; không thêm field bắt buộc ngoài đề.

**Task 1.2 — Render bảng tĩnh bằng HTML table thật**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Hiển thị hàng/cột từ props trước khi thêm tương tác.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.css`, `src/data/sample-data.ts`, `src/App.tsx`, `src/App.css`.
- **Phụ thuộc:** Task 1.1.
- **Hoàn thành khi:** Component nhận `data`, `columns`, `ariaLabel`; dùng `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, `<td>` thật; áp dụng `role="grid"`, `role="row"`, `role="gridcell"` và `columnheader` phù hợp; hiển thị trạng thái khi `data` rỗng; chưa có thao tác sort/filter/page/selection/keyboard.
- **Ghi chú semantics:** `th scope="col"` (role `columnheader`) xác định tiêu đề cột; `td` (role `gridcell`) được công bố là ô dữ liệu của grid. Các thẻ table native vẫn giữ trong DOM. Theo WAI-ARIA APG, grid là widget điều hướng bàn phím; phần điều hướng được để lại Task 3.2 theo phạm vi yêu cầu.
- **Cách kiểm tra và kết quả:** `npm run typecheck` và `npm run build` thành công; rà soát mã xác nhận đủ tag/role yêu cầu và nhánh dữ liệu rỗng. Kiểm tra accessibility tree/screen reader thủ công để ở Task 4.2.

### M2 — Sorting, filtering và pagination

**Task 2.1 — Sắp xếp theo cột**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Thêm sort tăng/giảm cho cột cho phép sort.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.css`, `src/components/data-grid/data-grid-utils.ts`, `src/App.tsx`.
- **Phụ thuộc:** Task 1.2.
- **Hoàn thành khi:** Chỉ cột `sortable: true` có nút sort; kích hoạt lặp lại theo chu kỳ mặc định → tăng dần → giảm dần → mặc định; chọn cột khác bắt đầu tăng dần; `aria-sort` chỉ có trên tiêu đề đang sort và chỉ báo hiển thị hướng sort; dữ liệu gốc từ props không bị mutate.
- **Cách kiểm tra và kết quả:** Kiểm tra thuần `sortRows` với số, chuỗi, giá trị bằng nhau và bất biến dữ liệu đầu vào; kiểm tra `getNextSortState` cho chu kỳ ba trạng thái và chuyển cột; `npm run typecheck` và `npm run build` đều thành công. Xác nhận cấu trúc tiêu đề bằng nút thật, trạng thái `aria-sort` trên `th`, và các cột không bật `sortable` không có nút. Kiểm thử tương tác bằng browser/accessibility tree còn để Task 4.2.

**Task 2.2 — Lọc dữ liệu**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Cho phép tìm kiếm không phân biệt hoa/thường trên các giá trị đang hiển thị, với control có label và thông báo kết quả.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.css`, `src/components/data-grid/data-grid-utils.ts`.
- **Phụ thuộc:** Task 1.2 và Task 2.1.
- **Hoàn thành khi:** Ô tìm kiếm có label thật; kết quả khớp theo giá trị hiển thị ở mọi cột; số kết quả cập nhật; không có kết quả thì có thông báo trong thân bảng; xóa từ khóa khôi phục mọi hàng; lọc được áp dụng trước sorting và không mutate dữ liệu gốc.
- **Cách kiểm tra và kết quả:** Kiểm tra helper với trường hợp tìm thấy không phân biệt hoa/thường, không tìm thấy, từ khóa rỗng và lọc kết hợp thứ tự sort; xác nhận dữ liệu đầu vào giữ nguyên; `npm run typecheck` và `npm run build` đều thành công. Kiểm tra label/thông báo trong accessibility tree bằng screen reader còn để Task 4.2. Pagination chưa được áp dụng ở task này.

**Task 2.3 — Pagination**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Chia kết quả đã lọc và sắp xếp thành các trang; điều hướng bằng button native có nhãn rõ.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.css`, `src/components/data-grid/data-grid-utils.ts`.
- **Phụ thuộc:** Task 2.1 và 2.2.
- **Hoàn thành khi:** Pipeline là filter → sort → paginate; hiển thị trang hiện tại/tổng trang và phạm vi hàng; Previous/Next có label và disable ở biên; giảm page count không để page index ngoài phạm vi; dữ liệu rỗng không hiện số trang 0; đổi trang giữ filter/sort; chỉ render hàng của trang hiện tại.
- **Cách kiểm tra:** Thử trang đầu/cuối, trang cuối không đầy, lọc từ trang cuối làm giảm tổng số trang, dữ liệu ít hơn một trang và không có kết quả; xác nhận filter/sort còn nguyên khi chuyển trang; typecheck/build. Không thêm điều hướng mũi tên ở task này.

### M3 — Chọn hàng và điều hướng bàn phím

**Task 3.1 — Chọn hàng và phản hồi selection**

- **Trạng thái:** Hoàn thành triển khai và browser flow (2026-10-23); callback runtime trong demo chưa kiểm tra vì App không truyền `onRowSelect`.
- **Mục tiêu:** Enter kích hoạt chọn dòng và callback; Space/click bật hoặc tắt dòng; lựa chọn giữ theo định danh ổn định qua sort, filter và pagination.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/data-grid-contract.ts`, `src/components/data-grid/data-grid-selection.ts`, `src/components/data-grid/DataGrid.css`, `src/App.tsx`.
- **Phụ thuộc:** Task 1.2.
- **Hoàn thành khi:** Enter gọi callback với đúng item; Space ngăn cuộn trang và toggle lựa chọn; click dùng cùng toggle; callback không bị gọi đôi; `aria-selected` và dấu trực quan phản ánh trạng thái; ID ổn định không phụ thuộc index, demo dùng `employeeId`; giữ native table/button.
- **Cách kiểm tra và kết quả:** Node harness kiểm tra Enter activation, Space bật/tắt, click bật/tắt và hành vi callback gate. Chrome headless browser chạy flow sort Department bằng Enter → filter `Active` (8/12) → Next bằng Enter (trang 2, 3 dòng) → ArrowRight/Down → Enter chọn `EMP-1314` → Space bỏ chọn và chọn lại; scrollY giữ nguyên 0. Click chuột bỏ/chọn dòng đạt. Sau khi lọc không có kết quả, thông báo rỗng và summary `Không có trang · 0 dòng` không tạo trang 0; lọc `Marketing` lại khôi phục chọn đúng `EMP-1314`. Kiểm tra identity qua sort/filter/page và hàng bị ẩn được lưu ở `artifacts/browser-rerun/browser-check-results.json`; ảnh từng trạng thái ở cùng thư mục. Callback thực tế không được truyền trong demo, nên callback API chỉ được rà một call site và kiểm tra transition helper, chưa được xác nhận bằng browser fixture.
**Task 3.2 — Điều hướng ô bằng phím mũi tên**

- **Trạng thái:** Hoàn thành (2026-10-23).
- **Mục tiêu:** Dùng roving `tabIndex` để di chuyển focus trong các ô đang hiển thị bằng Arrow Up/Down/Left/Right.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.css`, `src/components/data-grid/data-grid-keyboard.ts`.
- **Phụ thuộc:** Task 2.3. Row selection và Enter/Space vẫn thuộc Task 3.1, không nằm trong bước này.
- **Hoàn thành khi:** Tại mỗi thời điểm chỉ một gridcell đang hiển thị có `tabIndex=0`; bốn phím mũi tên di chuyển trong ranh giới các hàng/cột của trang hiện tại; khi filter/sort/page thay đổi, tọa độ được clamp và focus được khôi phục nếu trước đó ở trong ô grid; input tìm kiếm không nhận handler mũi tên của grid; focus hiển thị rõ.
- **Cách kiểm tra và kết quả:** Harness helper kiểm tra bốn hướng/clamp; Chrome browser test trên trang 2 cũng kiểm tra Arrow Up/Down/Left/Right, ranh giới trên-trái/dưới-phải và focus còn trong các ô hiện hành. Kết quả: `artifacts/browser-rerun/keyboard-boundaries.json`; `npm run typecheck` và `npm run build` đạt. Focus screenshot: `artifacts/browser-rerun/05-grid-arrow-focus.png`.

### M4 — Hoàn thiện giao diện và WCAG 2.2 AA

**Task 4.1 — Kiểu dáng, focus, tương phản và co giãn**

- **Mục tiêu:** Làm rõ hierarchy của bảng, trạng thái tương tác và khả năng đọc.
- **File dự kiến:** `src/styles.css`, `src/components/data-grid/DataGrid.tsx`.
- **Phụ thuộc:** Task 2.3 và 3.2.
- **Hoàn thành khi:** Chữ thường đạt tương phản tối thiểu 4.5:1; focus nhìn thấy rõ; hover/selected/sort/disabled không chỉ dựa vào màu; bảng dùng được ở viewport hẹp và zoom cao.
- **Cách kiểm tra:** Đo các cặp màu bằng công cụ contrast; kiểm tra focus hiển thị, zoom 200–400% và viewport hẹp; rà WCAG 2.2 AA bằng công cụ tự động và thủ công.
- **Ghi nhận rà soát liên quan (2026-10-23):** Script contrast kiểm tra 21 cặp chữ/nền, thấp nhất 7.58:1; hai màu focus indicator đạt tối thiểu 5.19:1 trên 8 nền trạng thái. Lighthouse 13.5.0 trên production build đạt Accessibility 100/100 và Best Practices 100/100 sau khi sửa 404 favicon. Chrome headless ở viewport 320×780 xác nhận scroll region rộng 286px chứa bảng rộng 928px, đủ 7 header; document không tràn ngang. Ảnh focus/selected và hai mép bảng hẹp ở `artifacts/browser-rerun/`. Zoom 200–400% chưa kiểm tra.
- **Trạng thái hiện tại:** Đã xác minh viewport 320×780 và focus cơ bản; còn cần kiểm tra zoom 200–400% trên trình duyệt thực.

**Task 4.2 — Rà semantics và hỗ trợ screen reader**

- **Mục tiêu:** Xác nhận người dùng screen reader hiểu cấu trúc, trạng thái và thao tác của grid.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.a11y.md` (nếu cần ghi chú thao tác/hỗ trợ).
- **Phụ thuộc:** Task 3.2 và 4.1.
- **Hoàn thành khi:** Tên grid, header, hàng/cột, sort, filter, pagination, focus và selection được công bố; không có thông báo lặp hoặc role xung đột giữa table semantics và grid interaction.
- **Cách kiểm tra:** Rà accessibility tree và kiểm tra keyboard + screen reader thủ công trên cấu hình hỗ trợ đã chọn; xử lý mọi lỗi nghiêm trọng/cao trước khi qua milestone.
- **Ghi nhận kiểm tra (2026-10-23):** Chrome Accessibility tree công bố grid có tên `Danh sách nhân sự`, tên scroll region, `columnheader`, `gridcell`, buttons/searchbox/status và row `selected=true`; lưu tại `artifacts/browser-rerun/chrome-accessibility-tree.json`. Lighthouse Accessibility đạt 100/100. Chưa chạy screen reader thực tế (NVDA/JAWS/VoiceOver), nên cách đọc và thông báo trên thiết bị hỗ trợ chưa được xác minh.
- **Trạng thái hiện tại:** Accessibility tree và keyboard đã kiểm tra trong Chrome; screen reader thực tế vẫn cần kiểm tra thủ công.

### M5 — Tích hợp và xác minh chất lượng cuối

**Task 5.1 — Tích hợp DataGrid vào trang mẫu**
- **Trạng thái:** Flow DataGrid trong browser đã kiểm tra (2026-10-23); `onRowSelect` callback chưa được App demo truyền vào.

- **Mục tiêu:** Dùng component với dữ liệu mẫu và xác nhận luồng thao tác end-to-end.
- **File dự kiến:** `src/App.tsx`, `src/data/sample-data.ts`.
- **Phụ thuộc:** Task 4.2.
- **Hoàn thành khi:** Trang mẫu thể hiện sorting, filtering, pagination, keyboard navigation và row selection; không phát sinh lỗi console hoặc type/build.
- **Cách kiểm tra và kết quả:** Production preview trên Chrome headless đã kiểm tra sort/filter/page, mũi tên, Enter/Space, click, trạng thái rỗng, phục hồi selection sau khi dòng bị lọc ẩn/hiện; console/page errors rỗng. Browser evidence ở `artifacts/browser-rerun/`; axe tree và kết quả chi tiết nằm trong JSON cùng thư mục. `npm run typecheck` và `npm run build` đạt. Callback API chưa được kiểm tra qua prop runtime vì demo hiện không truyền callback.

**Task 5.2 — Lighthouse và tiêu chí bàn giao**

- **Mục tiêu:** Kiểm chứng điểm Lighthouse bắt buộc và hoàn tất checklist.
- **File dự kiến:** `TASK_DECOMPOSITION.md` (cập nhật trạng thái/kết quả), `docs/accessibility-checklist.md` (nếu checklist cần tách riêng).
- **Phụ thuộc:** Task 5.1.
- **Hoàn thành khi:** Lighthouse đạt **100/100 Accessibility** và **100/100 Best Practices** trên production build; các điều kiện tương phản, semantics, keyboard và screen reader đã có kết quả kiểm tra; không còn lỗi được biết ảnh hưởng tiêu chí.
- **Cách kiểm tra:** Build production và chạy Lighthouse trên trang đã build; lưu lại URL/môi trường, phiên bản Lighthouse, hai điểm số và xử lý lại các audit fail cho đến khi đạt đúng 100/100; hoàn tất rà soát thủ công accessibility.
- **Kết quả đo (2026-10-23):** Lighthouse 13.5.0, URL `http://127.0.0.1:4173/`, production `vite preview`, Google Chrome 155.0.8059.85 headless, preset desktop, viewport 1350×940, fetchTime `2026-10-23T03:04:43.532Z`: Accessibility **100/100**, Best Practices **100/100**, không có audit fail. Lượt đầu đạt Accessibility 100/100 và Best Practices 96/100 do `errors-in-console` ghi 404 `/favicon.ico`; đã thêm `/favicon.svg` và rerun đạt 100/100. JSON reports: `artifacts/lighthouse/datagrid-desktop-2026-10-23.report.json` và `datagrid-desktop-rerun-2026-10-23.report.json`; ảnh report: `artifacts/browser-rerun/11-lighthouse-report.png`.

## Đối chiếu Git history (2026-10-23)

- `85aa5e8` contract TypeScript; `5ee06c4` bảng tĩnh; `5caee72` sorting; `4fae54b` filtering; `8a44ea0` pagination; `8b5e5c9` keyboard arrows; `424586f` row selection. `156ae5f` thêm bộ khung React + TypeScript + Vite trong commit riêng sau các milestone HW1. `git show --stat` xác nhận các commit có diff theo phạm vi; không có thao tác viết lại lịch sử.
- Các file bootstrap như `package.json`, `index.html`, `src/main.tsx`, cấu hình TypeScript/Vite và `project_rules.md` đã được track ở commit `156ae5f`. Branch hiện tại là `master`; `origin` trỏ đến `https://github.com/Phuthanh123456/hw_lab2_web.git`.

## Cách làm và cổng chuyển bước

- Thực hiện task theo thứ tự phụ thuộc; mỗi lần chỉ thay đổi phạm vi của task đang làm.
- Kết thúc mỗi task bằng các bước kiểm tra ghi trong task đó và ghi nhận kết quả trước khi bắt đầu task phụ thuộc.
- Mốc Lighthouse 100/100 là điều kiện bàn giao, không được suy ra từ build thành công hoặc chỉ từ điểm axe/accessibility tự động.
- Các thay đổi được kiểm tra trước khi commit; commit được giới hạn theo phạm vi đã ủy quyền.
