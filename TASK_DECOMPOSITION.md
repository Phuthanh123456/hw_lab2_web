# Homework 1 — Production Enterprise Data-Grid (WCAG 2.2 AA)

## Hiện trạng và nguyên tắc

Workspace ban đầu chưa có project files hoặc quy tắc dự án. `project_rules.md` được tạo để giữ phạm vi từng task nhỏ và yêu cầu kiểm tra trước commit. Task 0.1 đã tạo bộ khung; Tasks 0.2, 1.1 và 1.2 đã hoàn thành dữ liệu mẫu, contract và bảng tĩnh. Sorting, filtering, pagination, selection và điều hướng bàn phím vẫn đang chờ.

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

- **Mục tiêu:** Cho phép lọc dữ liệu bằng control có nhãn và thông báo kết quả.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/data-grid-utils.ts`.
- **Phụ thuộc:** Task 1.2.
- **Hoàn thành khi:** Bộ lọc hoạt động trên dữ liệu hiển thị; input có label rõ; trạng thái rỗng và số kết quả được thông báo; lọc kết hợp đúng với sort và pagination.
- **Cách kiểm tra:** Thử giá trị khớp/không khớp, xóa bộ lọc và lọc khi đang ở trang sau; kiểm tra đọc label/trạng thái với screen reader; typecheck/build.

**Task 2.3 — Pagination**

- **Mục tiêu:** Chia kết quả thành trang và điều hướng được bằng bàn phím.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`.
- **Phụ thuộc:** Task 2.1 và 2.2.
- **Hoàn thành khi:** Có điều hướng trang trước/sau và thông tin trang hiện tại; nút ở biên được disable đúng; thay đổi filter/sort không để trang hiện tại trỏ ngoài phạm vi; chỉ render hàng của trang hiện tại.
- **Cách kiểm tra:** Thử trang đầu/cuối, trang chỉ có một phần dữ liệu, đổi filter ở trang cuối; kiểm tra nhãn và trạng thái nút bằng keyboard/screen reader; typecheck/build.

### M3 — Chọn hàng và điều hướng bàn phím

**Task 3.1 — Chọn hàng và phản hồi selection**

- **Mục tiêu:** Hỗ trợ chọn/bỏ chọn hàng và gọi callback.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`.
- **Phụ thuộc:** Task 1.2.
- **Hoàn thành khi:** `onRowSelect` nhận đúng item; trạng thái chọn được hiển thị và công bố; Enter chọn hàng đang focus; Space bật/tắt chọn theo hợp đồng tương tác; không có nút giả bằng div.
- **Cách kiểm tra:** Thử Enter/Space trên hàng và kiểm tra trạng thái đã chọn trong accessibility tree; thử callback với nhiều hàng; typecheck/build.

**Task 3.2 — Điều hướng ô bằng phím mũi tên**

- **Mục tiêu:** Di chuyển focus giữa các ô bằng Arrow Up/Down/Left/Right.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/data-grid-keyboard.ts`.
- **Phụ thuộc:** Task 2.3 và 3.1.
- **Hoàn thành khi:** Mỗi phím mũi tên chuyển focus đúng ô; biên bảng không làm focus biến mất; focus hoạt động với pagination/filter; semantics `role="grid"`, `role="row"`, `role="gridcell"` được áp dụng trên cấu trúc table thật tại vị trí phù hợp, đồng thời header giữ semantics cột.
- **Cách kiểm tra:** Chỉ dùng bàn phím để đi qua các ô ở biên hàng/trang; rà accessibility tree và thử với screen reader; xác nhận không tạo div thay thế table; typecheck/build.

### M4 — Hoàn thiện giao diện và WCAG 2.2 AA

**Task 4.1 — Kiểu dáng, focus, tương phản và co giãn**

- **Mục tiêu:** Làm rõ hierarchy của bảng, trạng thái tương tác và khả năng đọc.
- **File dự kiến:** `src/styles.css`, `src/components/data-grid/DataGrid.tsx`.
- **Phụ thuộc:** Task 2.3 và 3.2.
- **Hoàn thành khi:** Chữ thường đạt tương phản tối thiểu 4.5:1; focus nhìn thấy rõ; hover/selected/sort/disabled không chỉ dựa vào màu; bảng dùng được ở viewport hẹp và zoom cao.
- **Cách kiểm tra:** Đo các cặp màu bằng công cụ contrast; kiểm tra focus hiển thị, zoom 200–400% và viewport hẹp; rà WCAG 2.2 AA bằng công cụ tự động và thủ công.

**Task 4.2 — Rà semantics và hỗ trợ screen reader**

- **Mục tiêu:** Xác nhận người dùng screen reader hiểu cấu trúc, trạng thái và thao tác của grid.
- **File dự kiến:** `src/components/data-grid/DataGrid.tsx`, `src/components/data-grid/DataGrid.a11y.md` (nếu cần ghi chú thao tác/hỗ trợ).
- **Phụ thuộc:** Task 3.2 và 4.1.
- **Hoàn thành khi:** Tên grid, header, hàng/cột, sort, filter, pagination, focus và selection được công bố; không có thông báo lặp hoặc role xung đột giữa table semantics và grid interaction.
- **Cách kiểm tra:** Rà accessibility tree và kiểm tra keyboard + screen reader thủ công trên cấu hình hỗ trợ đã chọn; xử lý mọi lỗi nghiêm trọng/cao trước khi qua milestone.

### M5 — Tích hợp và xác minh chất lượng cuối

**Task 5.1 — Tích hợp DataGrid vào trang mẫu**

- **Mục tiêu:** Dùng component với dữ liệu mẫu và xác nhận luồng thao tác end-to-end.
- **File dự kiến:** `src/App.tsx`, `src/data/sample-data.ts`.
- **Phụ thuộc:** Task 4.2.
- **Hoàn thành khi:** Trang mẫu thể hiện sorting, filtering, pagination, keyboard navigation và row selection; không phát sinh lỗi console hoặc type/build.
- **Cách kiểm tra:** Chạy ứng dụng, thao tác đầy đủ bằng bàn phím và chuột, kiểm tra console, chạy typecheck/build.

**Task 5.2 — Lighthouse và tiêu chí bàn giao**

- **Mục tiêu:** Kiểm chứng điểm Lighthouse bắt buộc và hoàn tất checklist.
- **File dự kiến:** `TASK_DECOMPOSITION.md` (cập nhật trạng thái/kết quả), `docs/accessibility-checklist.md` (nếu checklist cần tách riêng).
- **Phụ thuộc:** Task 5.1.
- **Hoàn thành khi:** Lighthouse đạt **100/100 Accessibility** và **100/100 Best Practices** trên production build; các điều kiện tương phản, semantics, keyboard và screen reader đã có kết quả kiểm tra; không còn lỗi được biết ảnh hưởng tiêu chí.
- **Cách kiểm tra:** Build production và chạy Lighthouse trên trang đã build; lưu lại URL/môi trường, phiên bản Lighthouse, hai điểm số và xử lý lại các audit fail cho đến khi đạt đúng 100/100; hoàn tất rà soát thủ công accessibility.

## Cách làm và cổng chuyển bước

- Thực hiện task theo thứ tự phụ thuộc; mỗi lần chỉ thay đổi phạm vi của task đang làm.
- Kết thúc mỗi task bằng các bước kiểm tra ghi trong task đó và ghi nhận kết quả trước khi bắt đầu task phụ thuộc.
- Mốc Lighthouse 100/100 là điều kiện bàn giao, không được suy ra từ build thành công hoặc chỉ từ điểm axe/accessibility tự động.
- Các thay đổi được kiểm tra trước khi commit; commit được giới hạn theo phạm vi đã ủy quyền.
