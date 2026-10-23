import type { ColumnDef, DataGridProps } from './data-grid-contract'

interface EmployeeRecord {
  id: number
  name: string
  department: string
}

const employeeColumns: ColumnDef<EmployeeRecord>[] = [
  { header: 'Name', accessorKey: 'name', sortable: true },
  { header: 'Department', accessorKey: 'department' },
]

const employeeGridProps: DataGridProps<EmployeeRecord> = {
  data: [{ id: 1, name: 'Linh Nguyen', department: 'Operations' }],
  columns: employeeColumns,
  onRowSelect: (item) => {
    const selectedId: number = item.id
    void selectedId
  },
  ariaLabel: 'Employees',
}

const invalidEmployeeColumn: ColumnDef<EmployeeRecord> = {
  header: 'Email',
  // @ts-expect-error "email" is not a key of EmployeeRecord.
  accessorKey: 'email',
}

void employeeGridProps
void invalidEmployeeColumn
