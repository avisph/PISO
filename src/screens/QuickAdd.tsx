import { useStore } from '../state/store'
import { TransactionSheet } from '../components/TransactionSheet'

/**
 * 1b — Quick-add. The sheet itself is shared with the edit flow; this is the
 * "add" entry point, reachable from every screen via the FAB or the N key.
 */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const [, dispatch] = useStore()

  return (
    <TransactionSheet
      mode="add"
      onClose={onClose}
      onSubmit={(transaction) => {
        dispatch({ type: 'transaction/add', transaction })
        onClose()
      }}
    />
  )
}
