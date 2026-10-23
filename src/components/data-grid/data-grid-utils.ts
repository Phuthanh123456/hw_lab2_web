export type SortDirection = 'ascending' | 'descending'

export interface SortState<T> {
  accessorKey: keyof T
  direction: SortDirection
}

export function getNextSortState<T>(
  current: SortState<T> | null,
  accessorKey: keyof T,
): SortState<T> | null {
  if (current === null || current.accessorKey !== accessorKey) {
    return { accessorKey, direction: 'ascending' }
  }

  if (current.direction === 'ascending') {
    return { accessorKey, direction: 'descending' }
  }

  return null
}

export function sortRows<T>(
  data: readonly T[],
  accessorKey: keyof T,
  direction: SortDirection,
): T[] {
  const directionMultiplier = direction === 'ascending' ? 1 : -1

  return [...data].sort((left, right) => {
    return compareValues(left[accessorKey], right[accessorKey]) * directionMultiplier
  })
}

export function filterRows<T>(
  data: readonly T[],
  accessorKeys: readonly (keyof T)[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  if (normalizedQuery === '') {
    return [...data]
  }

  return data.filter((row) =>
    accessorKeys.some((accessorKey) => {
      const value = row[accessorKey]
      const displayValue =
        value === null || value === undefined || value === '' ? '—' : String(value)

      return displayValue.toLocaleLowerCase().includes(normalizedQuery)
    }),
  )
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}
