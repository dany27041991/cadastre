/**
 * In-table column picker: checkbox list + back to table.
 */
import { Box, Checkbox, Text } from 'dxc-webkit'
import { useTranslation } from 'react-i18next'
import { BackNavHeader } from '@/shared/ui'
import {
  detailColumnsFor,
  type GreenTableKind,
} from '../../lib/greenDetailColumnCatalog'
import styles from './GreenTableColumnPicker.module.css'

export type GreenTableColumnPickerProps = {
  readonly kind: GreenTableKind
  readonly selectedKeys: string[]
  readonly onToggle: (key: string) => void
  readonly onBack: () => void
}

export function GreenTableColumnPicker({
  kind,
  selectedKeys,
  onToggle,
  onBack,
}: GreenTableColumnPickerProps) {
  const { t } = useTranslation()
  const catalog = detailColumnsFor(kind)
  const selected = new Set(selectedKeys)

  return (
    <Box as="div" className={styles.root} padding="m">
      <BackNavHeader
        backLabel={t('territory.table.columnsBack')}
        onBack={onBack}
        className={styles.back}
      />
      <Text
        font="f1-label-sm"
        className={styles.hint}
      >
        {t('territory.table.columnsHint')}
      </Text>
      <Box as="div" className={styles.list}>
        {catalog.map((key) => {
          const checked = selected.has(key)
          return (
            <Checkbox
              key={key}
              name={`green-table-col-${kind}-${key}`}
              className={styles.checkbox}
              label={t(`territory.panel.detail.meta.${key}`, {
                defaultValue: key,
              })}
              checked={checked}
              onChange={(value) => {
                if (value !== checked) onToggle(key)
              }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
