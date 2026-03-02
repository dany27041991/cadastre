/**
 * Centralized labels and i18n keys for territory navigation and map UI.
 * Use I18N_KEYS with t() for translated strings; fallbacks used when t is not provided.
 */
import type { TFunction } from 'i18next'

/** i18n translation keys (namespace: translation). */
export const I18N_KEYS = {
  italia: 'territory.italia',
  appTitle: 'territory.appTitle',
  greenAreas: 'territory.greenAreas',
  provinceSuffix: 'territory.provinceSuffix',
  clusterLabel: 'territory.clusterLabel',
  selected: 'territory.selected',
  navigationAria: 'territory.navigationAria',
  back: 'territory.back',
  loading: 'territory.loading',
  loadingGreenLayer: 'territory.loadingGreenLayer',
  loadingGreen: 'territory.loadingGreen',
  errorGeneric: 'errors.generic',
  regionIdRequired: 'errors.regionIdRequired',
} as const

/** Territory levels used in green context resolution (avoid magic strings). */
export const LEVEL_GREEN_AREAS = 'green_areas'
export const LEVEL_SUB_AREAS = 'sub_areas'

/** Fallback when i18n not used (e.g. tests). */
export const LABEL_ITALIA = 'Italia'
export const LABEL_GREEN_AREAS = 'Green areas'
export const SUFFIX_PROVINCE = ' Province'

export function formatClusterLabel(count: number): string {
  return `Cluster (${count})`
}

/** Returns translated or fallback label for cluster (for use in map setup when t is provided). */
export function getClusterLabel(count: number, t?: TFunction): string {
  return t ? t(I18N_KEYS.clusterLabel, { count }) : formatClusterLabel(count)
}
