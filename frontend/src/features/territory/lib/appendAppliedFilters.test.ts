import { describe, expect, it } from 'vitest'
import {
  FILTER_SCOPE_DENYLIST,
  appendAppliedFilters,
} from './appendAppliedFilters'

describe('appendAppliedFilters', () => {
  it('appends non-empty product keys', () => {
    const search = new URLSearchParams('region_id=16')
    appendAppliedFilters(search, { name: 'Garibaldi', species: '  Quercus  ' })
    expect(search.get('region_id')).toBe('16')
    expect(search.get('name')).toBe('Garibaldi')
    expect(search.get('species')).toBe('Quercus')
  })

  it('skips denylist and empty values', () => {
    const search = new URLSearchParams()
    appendAppliedFilters(search, {
      clip_wkt: 'POLYGON((0 0,1 0,1 1,0 1,0 0))',
      date_from: '2024-01-01',
      name: '',
      health_status: 'HEALTHY',
    })
    expect(search.has('clip_wkt')).toBe(false)
    expect(search.has('date_from')).toBe(false)
    expect(search.has('name')).toBe(false)
    expect(search.get('health_status')).toBe('HEALTHY')
  })

  it('denylist covers scope keys from design', () => {
    for (const key of [
      'bbox',
      'zoom',
      'green_area_id',
      'municipality_id',
      'page',
      'format',
    ]) {
      expect(FILTER_SCOPE_DENYLIST.has(key)).toBe(true)
    }
  })
})
