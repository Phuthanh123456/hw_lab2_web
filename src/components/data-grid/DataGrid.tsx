import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DataGridProps } from './data-grid-contract'
import {
  clampGridCellPosition,
  moveGridCellPosition,
  type GridArrowKey,
  type GridCellPosition,
} from './data-grid-keyboard'
import {
  filterRows,
  getNextSortState,
  paginateRows,
  sortRows,
  type SortState,
} from './data-grid-utils'
import './DataGrid.css'

const PAGE_SIZE = 5

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

export function DataGrid<T>({ data, columns, ariaLabel }: DataGridProps<T>) {
  const searchInputId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortState, setSortState] = useState<SortState<T> | null>(null)
  const [activeCell, setActiveCell] = useState<GridCellPosition>({ rowIndex: 0, columnIndex: 0 })
  const tableRef = useRef<HTMLTableElement>(null)
  const focusWithinGridRef = useRef(false)
  const filteredData = useMemo(
    () => filterRows(data, columns.map((column) => column.accessorKey), searchQuery),
    [columns, data, searchQuery],
  )
  const sortedData = useMemo(() => {
    if (sortState === null) {
      return filteredData
    }

    return sortRows(filteredData, sortState.accessorKey, sortState.direction)
  }, [filteredData, sortState])
  const [pageIndex, setPageIndex] = useState(0)
  const page = useMemo(
    () => paginateRows(sortedData, pageIndex, PAGE_SIZE),
    [pageIndex, sortedData],
  )
  const hasSearchQuery = searchQuery.trim() !== ''
  const rovingCell = clampGridCellPosition(activeCell, page.rows.length, columns.length)

  useEffect(() => {
    setPageIndex(page.pageIndex)
  }, [page.pageIndex])

  useLayoutEffect(() => {
    const validCell = clampGridCellPosition(activeCell, page.rows.length, columns.length)
    setActiveCell((current) =>
      current.rowIndex === validCell.rowIndex && current.columnIndex === validCell.columnIndex
        ? current
        : validCell,
    )

    if (!focusWithinGridRef.current || page.rows.length === 0 || columns.length === 0) {
      return
    }

    focusGridCell(validCell)
  }, [page.rows, columns.length])

  function focusGridCell(position: GridCellPosition): void {
    const cell = tableRef.current?.querySelector<HTMLTableCellElement>(
      `[data-grid-row-index="${position.rowIndex}"][data-grid-column-index="${position.columnIndex}"]`,
    )
    cell?.focus()
  }

  function handleGridCellKeyDown(
    event: React.KeyboardEvent<HTMLTableCellElement>,
    position: GridCellPosition,
  ): void {
    if (!isGridArrowKey(event.key)) {
      return
    }

    event.preventDefault()
    const nextPosition = moveGridCellPosition(
      position,
      event.key,
      page.rows.length,
      columns.length,
    )
    setActiveCell(nextPosition)
    focusGridCell(nextPosition)
  }

  function handleGridCellBlur(): void {
    queueMicrotask(() => {
      const activeElement = document.activeElement
      const activeGridCell = activeElement?.matches('[role="gridcell"]') ?? false
      focusWithinGridRef.current = Boolean(
        activeGridCell && tableRef.current?.contains(activeElement),
      )
    })
  }

  return (
    <div className="data-grid__container">
      <div className="data-grid__toolbar">
        <div className="data-grid__search-field">
          <label htmlFor={searchInputId}>Tìm kiếm trong bảng</label>
          <input
            id={searchInputId}
            className="data-grid__search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </div>
        <p className="data-grid__result-count" role="status" aria-live="polite">
          {filteredData.length} / {data.length} kết quả
        </p>
      </div>

      <div className="data-grid__viewport">
        <table ref={tableRef} className="data-grid" role="grid" aria-label={ariaLabel}>
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
            {filteredData.length === 0 ? (
              <tr role="row">
                <td
                  className="data-grid__empty"
                  role="gridcell"
                  colSpan={Math.max(columns.length, 1)}
                >
                  {hasSearchQuery
                    ? `Không tìm thấy kết quả cho “${searchQuery.trim()}”.`
                    : 'Không có dữ liệu để hiển thị.'}
                </td>
              </tr>
            ) : (
              page.rows.map((item, rowIndex) => (
                <tr key={rowIndex} role="row">
                  {columns.map((column, columnIndex) => (
                    <td
                      key={columnIndex}
                      role="gridcell"
                      className="data-grid__cell"
                      data-grid-row-index={rowIndex}
                      data-grid-column-index={columnIndex}
                      tabIndex={
                        rovingCell.rowIndex === rowIndex &&
                        rovingCell.columnIndex === columnIndex
                          ? 0
                          : -1
                      }
                      onFocus={() => {
                        focusWithinGridRef.current = true
                        setActiveCell({ rowIndex, columnIndex })
                      }}
                      onBlur={handleGridCellBlur}
                      onKeyDown={(event) =>
                        handleGridCellKeyDown(event, { rowIndex, columnIndex })
                      }
                    >
                      {formatCellValue(item[column.accessorKey])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="data-grid__pagination" aria-label="Điều hướng trang dữ liệu">
        <p className="data-grid__page-summary" role="status" aria-live="polite">
          {page.pageCount === 0
            ? 'Không có trang · 0 dòng'
            : `Trang ${page.pageIndex + 1} / ${page.pageCount} · Dòng ${page.startRow}–${page.endRow} / ${sortedData.length}`}
        </p>
        <div className="data-grid__page-controls">
          <button
            type="button"
            className="data-grid__page-button"
            aria-label="Trang trước"
            disabled={page.pageCount === 0 || page.pageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
          >
            Trang trước
          </button>
          <button
            type="button"
            className="data-grid__page-button"
            aria-label="Trang tiếp theo"
            disabled={page.pageCount === 0 || page.pageIndex === page.pageCount - 1}
            onClick={() =>
              setPageIndex((current) =>
                Math.min(current + 1, Math.max(page.pageCount - 1, 0)),
              )
            }
          >
            Trang tiếp theo
          </button>
        </div>
      </nav>
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

function isGridArrowKey(key: string): key is GridArrowKey {
  return (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight'
  )
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
