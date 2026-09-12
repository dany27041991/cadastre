/**
 * "Go to page" number input for the green data table top bar.
 */
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Text } from 'dxc-webkit'

export type GreenTablePageJumpProps = {
  page: number
  totalPages: number
  pageInput: string
  loading: boolean
  onPageInputChange: (value: string) => void
  onCommit: () => void
}

export const GreenTablePageJump: FC<GreenTablePageJumpProps> = ({
  page: _page,
  totalPages,
  pageInput,
  loading,
  onPageInputChange,
  onCommit,
}) => {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <Box as="div" className="green-data-table-page-jump green-data-table-page-jump--top">
      <label className="green-data-table-page-jump-label" htmlFor="green-table-page-jump">
        <Text as="span" font="f1-body-sm">
          {t('territory.table.goToPageLabel')}
        </Text>
      </label>
      <input
        id="green-table-page-jump"
        type="number"
        className="green-data-table-page-jump-input"
        min={1}
        max={totalPages}
        value={pageInput}
        disabled={loading}
        aria-label={t('territory.table.goToPageAria', { max: totalPages })}
        onChange={(e) => onPageInputChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit()
          }
        }}
      />
      <Text as="span" font="f1-body-sm" className="green-data-table-page-jump-suffix">
        {t('territory.table.goToPageOf', { total: totalPages })}
      </Text>
    </Box>
  )
}
