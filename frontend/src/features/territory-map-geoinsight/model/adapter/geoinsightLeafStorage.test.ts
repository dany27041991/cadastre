import { describe, expect, it } from 'vitest'
import { createGeoinsightLeafStorage } from './geoinsightLeafStorage'

describe('createGeoinsightLeafStorage', () => {
  it('stores and retrieves leaf area by id', () => {
    const storage = createGeoinsightLeafStorage()
    const feature = {
      id: 42,
      label: 'Leaf',
      properties: { name: 'Leaf' },
      geometry: { type: 'Polygon', coordinates: [] },
    }
    storage.store(42, feature)
    expect(storage.get(42)).toBe(feature)
    expect(storage.get(99)).toBeNull()
  })

  it('clears stored leaf area', () => {
    const storage = createGeoinsightLeafStorage()
    storage.store(1, { id: 1, label: '1', properties: {}, geometry: {} })
    storage.clear()
    expect(storage.get(1)).toBeNull()
  })
})
