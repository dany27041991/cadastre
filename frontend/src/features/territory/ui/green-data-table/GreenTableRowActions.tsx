/**
 * Actions column: EllipsysIcon (⋯) and row menu via portal (avoids dxc-webkit Tooltip /
 * reactstrap PopperContent where transition is not forwarded → transition.timeout warning).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { icons } from 'dxc-webkit'

const { EllipsysIcon } = icons

export type GreenTableRawRow = Record<string, unknown>

export interface GreenTableRowActionsProps {
  readonly rawRow: GreenTableRawRow
  readonly onDetail?: (row: GreenTableRawRow) => void
  readonly onEdit?: (row: GreenTableRawRow) => void
  readonly onRemove?: (row: GreenTableRawRow) => void
}

export function GreenTableRowActions({
  rawRow,
  onDetail,
  onEdit,
  onRemove,
}: GreenTableRowActionsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId().replace(/:/g, '-')
  const [pos, setPos] = useState({ left: 0, top: 0 })

  const updatePosition = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ left: rect.right, top: rect.top })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const el = e.target as Node
      if (btnRef.current?.contains(el)) return
      if (menuRef.current?.contains(el)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown, true)
    return () => document.removeEventListener('mousedown', onMouseDown, true)
  }, [open])

  const run = (fn?: (row: GreenTableRawRow) => void) => {
    setOpen(false)
    fn?.(rawRow)
  }

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="green-table-row-actions-menu"
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          transform: 'translate(-100%, calc(-100% - 6px))',
          zIndex: 1060,
        }}
        role="dialog"
        aria-label={t('territory.table.tooltipMenuTitle')}
      >
        <div className="green-table-row-actions-menu__title">
          {t('territory.table.tooltipMenuTitle')}
        </div>
        <span className="green-table-row-actions-tooltip__actions">
          <button
            type="button"
            className="green-table-row-actions-tooltip__action green-table-row-actions-tooltip__action--default"
            onClick={() => run(onDetail)}
          >
            {t('territory.table.detail')}
          </button>
          <button
            type="button"
            className="green-table-row-actions-tooltip__action green-table-row-actions-tooltip__action--default"
            onClick={() => run(onEdit)}
          >
            {t('territory.table.edit')}
          </button>
          <button
            type="button"
            className="green-table-row-actions-tooltip__action green-table-row-actions-tooltip__action--danger"
            onClick={() => run(onRemove)}
          >
            {t('territory.table.remove')}
          </button>
        </span>
      </div>,
      document.body
    )

  return (
    <div className="actions-container green-table-row-actions">
      <button
        ref={btnRef}
        id={menuId}
        type="button"
        className="green-table-row-actions__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('territory.table.rowActionsMenu')}
        onClick={toggle}
      >
        <EllipsysIcon
          size="sm"
          stroke="primary"
          fill="transparent"
          className="green-table-row-actions__ellipsys"
        />
      </button>
      {menu}
    </div>
  )
}
