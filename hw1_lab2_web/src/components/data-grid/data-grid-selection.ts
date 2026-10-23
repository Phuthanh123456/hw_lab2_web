export type RowSelectionAction = 'activate' | 'toggle'

export interface RowSelectionTransition {
  selectedRowId: string | null
  shouldCallOnRowSelect: boolean
}

export function getRowSelectionTransition(
  currentSelectedRowId: string | null,
  targetRowId: string,
  action: RowSelectionAction,
): RowSelectionTransition {
  if (action === 'activate') {
    return { selectedRowId: targetRowId, shouldCallOnRowSelect: true }
  }

  if (currentSelectedRowId === targetRowId) {
    return { selectedRowId: null, shouldCallOnRowSelect: false }
  }

  return { selectedRowId: targetRowId, shouldCallOnRowSelect: true }
}
