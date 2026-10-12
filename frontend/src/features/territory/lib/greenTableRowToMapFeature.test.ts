import { describe, expect, it } from 'vitest'
import { resolveGreenFeatureFromTableRow } from './greenTableRowToMapFeature'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'

describe('resolveGreenFeatureFromTableRow', () => {
  it('does not reuse mounted feature with same id from another municipality', () => {
    const wrongMounted: TerritoryMapFeature = {
      id: 3,
      label: 'Wrong',
      properties: {
        name: 'Wrong',
        region_id: 1,
        province_id: 10,
        municipality_id: 156,
        zril_identifier: 'ZRIL-156-3',
      },
      geometry: { type: 'Polygon', coordinates: [] },
    }
    const row = {
      id: 3,
      name: 'Area boost',
      region_id: 1,
      province_id: 10,
      municipality_id: 1,
      zril_identifier: 'ZRIL-1-3',
    }
    const resolved = resolveGreenFeatureFromTableRow(row, 'area', [wrongMounted])
    expect(resolved).not.toBeNull()
    expect(resolved!.feature.properties.municipality_id).toBe(1)
    expect(resolved!.feature.properties.zril_identifier).toBe('ZRIL-1-3')
    // Wrong mounted geometry must not be kept.
    expect(resolved!.feature.geometry).toEqual({})
  })

  it('keeps mounted geometry when id and municipality match', () => {
    const geom = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    const mounted: TerritoryMapFeature = {
      id: 3,
      label: 'Area boost',
      properties: {
        name: 'Area boost',
        region_id: 1,
        province_id: 10,
        municipality_id: 1,
      },
      geometry: geom,
    }
    const row = {
      id: 3,
      name: 'Area boost',
      region_id: 1,
      province_id: 10,
      municipality_id: 1,
    }
    const resolved = resolveGreenFeatureFromTableRow(row, 'area', [mounted])
    expect(resolved!.feature.geometry).toBe(geom)
    expect(resolved!.feature.properties.municipality_id).toBe(1)
  })
})
