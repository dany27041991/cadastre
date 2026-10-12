import { describe, expect, it } from 'vitest'
import {
  HIT_PAD_LINE_DEG,
  HIT_PAD_POINT_DEG,
  geometryHitKind,
  lonLatHitsGeometry,
} from './geometryHitTest'

describe('geometryHitKind', () => {
  it('classifies GeoJSON types', () => {
    expect(geometryHitKind({ type: 'Point', coordinates: [0, 0] })).toBe('point')
    expect(geometryHitKind({ type: 'MultiLineString', coordinates: [] })).toBe('line')
    expect(geometryHitKind({ type: 'Polygon', coordinates: [] })).toBe('surface')
    expect(geometryHitKind({})).toBe('unknown')
  })
})

describe('lonLatHitsGeometry', () => {
  it('hits points within pad and misses outside', () => {
    const geom = { type: 'Point', coordinates: [12.5, 41.9] }
    expect(lonLatHitsGeometry(geom, 12.5, 41.9)).toBe(true)
    expect(lonLatHitsGeometry(geom, 12.5 + HIT_PAD_POINT_DEG * 0.5, 41.9)).toBe(true)
    expect(lonLatHitsGeometry(geom, 12.5 + HIT_PAD_POINT_DEG * 2, 41.9)).toBe(false)
  })

  it('hits lines near the stroke', () => {
    const geom = {
      type: 'LineString',
      coordinates: [
        [12.0, 42.0],
        [12.2, 42.0],
      ],
    }
    expect(lonLatHitsGeometry(geom, 12.1, 42.0)).toBe(true)
    expect(lonLatHitsGeometry(geom, 12.1, 42.0 + HIT_PAD_LINE_DEG * 0.5)).toBe(true)
    expect(lonLatHitsGeometry(geom, 12.1, 42.0 + HIT_PAD_LINE_DEG * 3)).toBe(false)
  })

  it('hits polygons via point-in-polygon (not bbox interior holes)', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [12.0, 42.0],
          [12.2, 42.0],
          [12.2, 42.2],
          [12.0, 42.2],
          [12.0, 42.0],
        ],
      ],
    }
    expect(lonLatHitsGeometry(geom, 12.1, 42.1)).toBe(true)
    expect(lonLatHitsGeometry(geom, 12.3, 42.1)).toBe(false)
  })

  it('respects polygon holes', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
    }
    expect(lonLatHitsGeometry(geom, 0.5, 0.5)).toBe(true)
    expect(lonLatHitsGeometry(geom, 2, 2)).toBe(false)
  })

  it('hits MultiPolygon and MultiLineString members', () => {
    const multiPoly = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
      ],
    }
    expect(lonLatHitsGeometry(multiPoly, 10.5, 10.5)).toBe(true)
    expect(lonLatHitsGeometry(multiPoly, 12, 12)).toBe(false)

    const multiLine = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 0],
        ],
      ],
    }
    expect(lonLatHitsGeometry(multiLine, 0.5, 0)).toBe(true)
  })
})
