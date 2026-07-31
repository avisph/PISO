import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The shell every add/edit sheet shares: the scrim, Escape, click-outside,
 * the save row, and a delete that asks once before it does anything.
 *
 * The three things it wraps — accounts, bills, debts — differ only in their
 * fields, so the chrome lives here and each sheet supplies the middle.
 */
export function RecordSheet({
  title,
  mode,
  canSave,
  saveLabel,
  onSave,
  onClose,
  onDelete,
  deleteLabel = 'Delete',
  deleteBlockedReason,
  children,
}: {
  title: string
  mode: 'add' | 'edit'
  canSave: boolean
  saveLabel?: string
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
  deleteLabel?: string
  /** Set when deleting is refused — shown instead of the button doing nothing. */
  deleteBlockedReason?: string | null
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave) onSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (!sheetRef.current?.contains(e.target as Node)) onClose()
      }}
    >
      <div className="sheet sheet--form" ref={sheetRef}>
        <div className="sheet__grip" />

        <div className="row-between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 15 }}>{title}</span>
          <button type="button" className="sheet__x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {children}
        </div>

        <button
          type="button"
          className="btn-outline btn-outline--sm"
          disabled={!canSave}
          onClick={onSave}
          style={{ marginTop: 14 }}
        >
          {saveLabel ?? (mode === 'add' ? 'Add' : 'Save changes')}
        </button>

        {mode === 'edit' && onDelete && (
          <>
            <button
              type="button"
              className="btn-quiet"
              disabled={Boolean(deleteBlockedReason)}
              style={
                confirming ? { color: 'var(--p-danger)', borderColor: 'var(--p-danger)' } : undefined
              }
              onClick={() => (confirming ? onDelete() : setConfirming(true))}
            >
              {confirming ? 'Sigurado? Pindutin ulit para burahin' : deleteLabel}
            </button>
            {deleteBlockedReason && (
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, textAlign: 'center' }}>
                {deleteBlockedReason}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
