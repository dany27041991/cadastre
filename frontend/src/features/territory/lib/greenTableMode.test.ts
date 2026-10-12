import { describe, expect, it } from 'vitest'
import { hasIngestDateRange } from './ingestDateRange'
import {
  buildGreenAreasTableQuery,
  buildGreenAssetsTableQuery,
} from './greenTableParams'
import { resolveGreenTableMode, withGreenAreaId } from './greenTableMode'
import type { BreadcrumbCrumb } from '../types'

describe('hasIngestDateRange', () => {
  it('is false when either bound is missing', () => {
    expect(hasIngestDateRange(null, new Date())).toBe(false)
    expect(hasIngestDateRange(new Date(), null)).toBe(false)
    expect(hasIngestDateRange(undefined, undefined)).toBe(false)
  })

  it('is true when from ≤ to', () => {
    expect(hasIngestDateRange(new Date(2026, 0, 1), new Date(2026, 8, 30))).toBe(true)
    expect(hasIngestDateRange(new Date(2026, 0, 1), new Date(2026, 0, 1))).toBe(true)
  })

  it('is false when from > to', () => {
    expect(hasIngestDateRange(new Date(2026, 8, 1), new Date(2026, 0, 1))).toBe(false)
  })
})

describe('buildGreen*TableQuery scope', () => {
  it('nationwide empty breadcrumb yields only dates (empty scope is valid)', () => {
    const q = buildGreenAssetsTableQuery([], null, {
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    })
    const p = new URLSearchParams(q)
    expect(p.get('region_id')).toBeNull()
    expect(p.get('municipality_id')).toBeNull()
    expect(p.get('date_from')).toBe('2026-01-01')
  })

  it('areas use area_id for green leaf; assets use green_area_id', () => {
    const crumbs: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
      { level: 'municipalities', id: 75, label: 'Lecce' },
      {
        level: 'green_areas',
        id: 5998,
        label: 'Aree',
        regionId: 16,
        provinceId: 75,
      },
      {
        level: 'sub_areas',
        id: 1001,
        label: 'Parco',
        regionId: 16,
        provinceId: 75,
        municipalityId: 5998,
      },
    ]
    const areas = new URLSearchParams(
      buildGreenAreasTableQuery('sub_areas', crumbs, null, {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    )
    const assets = new URLSearchParams(
      buildGreenAssetsTableQuery(crumbs, null, {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    )
    expect(areas.get('area_id')).toBe('1001')
    expect(areas.get('green_area_id')).toBeNull()
    expect(assets.get('green_area_id')).toBe('1001')
    expect(assets.get('area_id')).toBeNull()
  })
})

describe('resolveGreenTableMode', () => {
  it('OFF/OFF and areas-only show area table', () => {
    expect(resolveGreenTableMode(false, false, null).tableKind).toBe('area')
    expect(resolveGreenTableMode(true, false, null)).toMatchObject({
      dualMode: false,
      showGreenAssets: false,
      tableKind: 'area',
    })
  })

  it('assets-only shows asset table', () => {
    expect(resolveGreenTableMode(false, true, null)).toMatchObject({
      dualMode: false,
      showGreenAssets: true,
      tableKind: 'asset',
    })
  })

  it('dual without drill stays on areas; with drill switches to assets', () => {
    expect(resolveGreenTableMode(true, true, null)).toMatchObject({
      dualMode: true,
      showGreenAssets: false,
      tableKind: 'area',
    })
    expect(resolveGreenTableMode(true, true, 42)).toMatchObject({
      dualMode: true,
      showGreenAssets: true,
      tableKind: 'asset',
    })
  })
})

describe('withGreenAreaId', () => {
  it('sets green_area_id on the territory query', () => {
    const q = withGreenAreaId('date_from=2026-01-01&date_to=2026-12-31', 99)
    const p = new URLSearchParams(q)
    expect(p.get('green_area_id')).toBe('99')
    expect(p.get('date_from')).toBe('2026-01-01')
  })
})
