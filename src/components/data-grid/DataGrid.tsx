import type { DataGridProps } from './data-grid-contract'
import './DataGrid.css'

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

export function DataGrid<T>({ data, columns, ariaLabel }: DataGridProps<T>) {
  return (
    <div className="data-grid__viewport">
      <table className="data-grid" role="grid" aria-label={ariaLabel}>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((column, columnIndex) => (
              <th
                key={columnIndex}
                scope="col"
                role="columnheader"
                className="data-grid__heading"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {data.length === 0 ? (
            <tr role="row">
              <td
                className="data-grid__empty"
                role="gridcell"
                colSpan={Math.max(columns.length, 1)}
              >
                Không có dữ liệu để hiển thị.
              </td>
            </tr>
          ) : (
            data.map((item, rowIndex) => (
              <tr key={rowIndex} role="row">
                {columns.map((column, columnIndex) => (
                  <td key={columnIndex} role="gridcell" className="data-grid__cell">
                    {formatCellValue(item[column.accessorKey])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
