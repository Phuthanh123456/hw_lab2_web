export function ScaffoldStatus() {
  return (
    <section className="status-card" aria-labelledby="status-title">
      <div className="status-icon" aria-hidden="true">
        ✓
      </div>
      <div>
        <p className="status-label">Nền tảng sẵn sàng</p>
        <h2 id="status-title">Bộ khung dự án đã khởi tạo</h2>
        <p className="status-description">
          Trang demo đang chạy trên Vite. Task tiếp theo sẽ chuẩn bị dữ liệu mẫu;
          phần DataGrid và các tương tác chưa được triển khai.
        </p>
      </div>
    </section>
  )
}
