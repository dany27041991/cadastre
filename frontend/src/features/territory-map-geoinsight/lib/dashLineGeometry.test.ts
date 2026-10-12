import { describe, expect, it } from 'vitest'
import { dashLineStringCoordinates, dashLinearGeometry } from './dashLineGeometry'

describe('dashLineStringCoordinates', () => {
  it('splits a straight line into alternating segments', () => {
    const segments = dashLineStringCoordinates(
      [
        [12, 41],
        [12.001, 41],
      ],
      30,
      20
    )
    expect(segments.length).toBeGreaterThan(1)
    for (const segment of segments) {
      expect(segment.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('dashLinearGeometry', () => {
  it('converts LineString to dashed MultiLineString when needed', () => {
    const geometry = {
      type: 'LineString',
      coordinates: [
        [12, 41],
        [12.002, 41],
        [12.004, 41],
      ],
    }
    const dashed = dashLinearGeometry(geometry) as { type: string; coordinates: unknown[] }
    expect(['LineString', 'MultiLineString']).toContain(dashed.type)
    expect(Array.isArray(dashed.coordinates)).toBe(true)
  })

  it('returns polygon geometry unchanged', () => {
    const polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    }
    expect(dashLinearGeometry(polygon)).toBe(polygon)
  })
})
