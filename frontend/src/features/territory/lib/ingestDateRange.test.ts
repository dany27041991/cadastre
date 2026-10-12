import { describe, expect, it } from 'vitest'
import { buildGreenAssetViewportQuery } from '../api/greenAssetMap.api'
import { buildGreenAreasViewportQuery } from '../api/greenAreaMap.api'
import {
  buildGreenAreasTableQuery,
  buildGreenAssetsTableQuery,
} from '../lib/greenTableParams'
import { defaultIngestDateRange, toIsoDate } from '../lib/ingestDateRange'
import type { BreadcrumbCrumb } from '../types'

describe('ingest date range helpers', () => {
  it('defaults to last 12 months', () => {
    const now = new Date(2026, 8, 4)
    const { dateFrom, dateTo } = defaultIngestDateRange(now)
    expect(toIsoDate(dateTo)).toBe('2026-09-04')
    expect(toIsoDate(dateFrom)).toBe('2025-09-04')
  })
})

describe('viewport query builders date params', () => {
  it('appends date_from and date_to on assets viewport', () => {
    const q = buildGreenAssetViewportQuery({
      bbox: [18, 40, 18.3, 40.5],
      zoom: 12,
      dateFrom: '2025-01-01',
      dateTo: '2026-09-04',
    })
    const p = new URLSearchParams(q)
    expect(p.get('date_from')).toBe('2025-01-01')
    expect(p.get('date_to')).toBe('2026-09-04')
  })

  it('appends date_from and date_to on areas viewport', () => {
    const q = buildGreenAreasViewportQuery({
      bbox: [18, 40, 18.3, 40.5],
      zoom: 12,
      dateFrom: '2025-01-01',
      dateTo: '2026-09-04',
    })
    const p = new URLSearchParams(q)
    expect(p.get('date_from')).toBe('2025-01-01')
    expect(p.get('date_to')).toBe('2026-09-04')
  })
})

describe('table query builders date params', () => {
  const crumbs: BreadcrumbCrumb[] = []

  it('appends dates on assets table query', () => {
    const q = buildGreenAssetsTableQuery(crumbs, null, {
      dateFrom: '2025-01-01',
      dateTo: '2026-09-04',
    })
    const p = new URLSearchParams(q)
    expect(p.get('date_from')).toBe('2025-01-01')
    expect(p.get('date_to')).toBe('2026-09-04')
  })

  it('appends dates on areas table query', () => {
    const q = buildGreenAreasTableQuery('regions', crumbs, null, {
      dateFrom: '2025-01-01',
      dateTo: '2026-09-04',
    })
    const p = new URLSearchParams(q)
    expect(p.get('date_from')).toBe('2025-01-01')
    expect(p.get('date_to')).toBe('2026-09-04')
  })
})
