import { DataGrid } from './components/data-grid/DataGrid'
import type { ColumnDef } from './components/data-grid/data-grid-contract'
import { employeeRecords, type EmployeeRecord } from './data/sample-data'
import './App.css'

const employeeColumns: ColumnDef<EmployeeRecord>[] = [
  { header: 'Employee ID', accessorKey: 'employeeId' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Department', accessorKey: 'department' },
  { header: 'Office', accessorKey: 'office' },
  { header: 'Employment type', accessorKey: 'employmentType' },
  { header: 'Status', accessorKey: 'status' },
  { header: 'Years at company', accessorKey: 'yearsAtCompany' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Lab 2 · Homework 1</p>
        <h1>Production Enterprise Data-Grid</h1>
        <p className="page-intro">
          Danh sách nhân sự mẫu với nhiều phòng ban, văn phòng và trạng thái làm việc.
        </p>
      </header>

      <main>
        <section className="dataset" aria-labelledby="dataset-title">
          <div className="dataset-heading">
            <div>
              <p className="eyebrow">Dữ liệu demo</p>
              <h2 id="dataset-title">Nhân sự</h2>
            </div>
            <p className="dataset-count">{employeeRecords.length} hồ sơ mẫu</p>
          </div>
          <DataGrid
            data={employeeRecords}
            columns={employeeColumns}
            ariaLabel="Danh sách nhân sự"
          />
        </section>
      </main>

      <footer className="page-footer">Homework 1 · Lab 2</footer>
    </div>
  )
}

export default App
