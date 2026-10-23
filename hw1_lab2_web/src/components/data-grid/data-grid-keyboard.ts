export interface GridCellPosition {
  rowIndex: number
  columnIndex: number
}

export type GridArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export function clampGridCellPosition(
  position: GridCellPosition,
  rowCount: number,
  columnCount: number,
): GridCellPosition {
  return {
    rowIndex: Math.min(Math.max(position.rowIndex, 0), Math.max(rowCount - 1, 0)),
    columnIndex: Math.min(
      Math.max(position.columnIndex, 0),
      Math.max(columnCount - 1, 0),
    ),
  }
}

export function moveGridCellPosition(
  position: GridCellPosition,
  key: GridArrowKey,
  rowCount: number,
  columnCount: number,
): GridCellPosition {
  const nextPosition = { ...position }

  switch (key) {
    case 'ArrowUp':
      nextPosition.rowIndex -= 1
      break
    case 'ArrowDown':
      nextPosition.rowIndex += 1
      break
    case 'ArrowLeft':
      nextPosition.columnIndex -= 1
      break
    case 'ArrowRight':
      nextPosition.columnIndex += 1
      break
  }

  return clampGridCellPosition(nextPosition, rowCount, columnCount)
}
