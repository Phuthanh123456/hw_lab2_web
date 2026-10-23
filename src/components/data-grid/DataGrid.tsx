import { useMemo, useState } from 'react'
import type { DataGridProps } from './data-grid-contract'
import { getNextSortState, sortRows, type SortState } from './data-grid-utils'
import './DataGrid.css'

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

export function DataGrid<T>({ data, columns, ariaLabel }: DataGridProps<T>) {
  const [sortState, setSortState] = useState<SortState<T> | null>(null)
  const sortedData = useMemo(() => {
    if (sortState === null) {
      return data
    }

    return sortRows(data, sortState.accessorKey, sortState.direction)
  }, [data, sortState])

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
                aria-sort={
                  sortState?.accessorKey === column.accessorKey
                    ? sortState.direction
                    : undefined
                }
              >
                {column.sortable === true ? (
                  <button
                    type="button"
                    className="data-grid__sort-button"
                    aria-label={getSortButtonLabel(column.header, sortState, column.accessorKey)}
                    onClick={() =>
                      setSortState((current) =>
                        getNextSortState(current, column.accessorKey),
                      )
                    }
                  >
                    <span>{column.header}</span>
                    <span className="data-grid__sort-indicator" aria-hidden="true">
                      {getSortIndicator(sortState, column.accessorKey)}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
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
            sortedData.map((item, rowIndex) => (
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

function getSortIndicator<T>(
  sortState: SortState<T> | null,
  accessorKey: keyof T,
): string {
  if (sortState?.accessorKey !== accessorKey) {
    return '↕'
  }

  return sortState.direction === 'ascending' ? '↑' : '↓'
}

function getSortButtonLabel<T>(
  header: string,
  sortState: SortState<T> | null,
  accessorKey: keyof T,
): string {
  if (sortState?.accessorKey !== accessorKey) {
    return `${header}, chưa sắp xếp; nhấn để sắp xếp tăng dần`
  }

  if (sortState.direction === 'ascending') {
    return `${header}, đang sắp xếp tăng dần; nhấn để sắp xếp giảm dần`
  }

  return `${header}, đang sắp xếp giảm dần; nhấn để bỏ sắp xếp`
}
