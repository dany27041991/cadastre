import { describe, expect, it } from 'vitest'
import {
  bboxFromPolygon,
  clipPayloadToPolygon,
  polygonToWkt,
} from './spatialClipWkt'

const LECCE: [number, number][] = [
  [18.1, 40.3],
  [18.3, 40.3],
  [18.3, 40.5],
  [18.1, 40.5],
  [18.1, 40.3],
]

describe('clipPayloadToPolygon', () => {
  it('accepts Geoinsight WKT clip', () => {
    const polygon = clipPayloadToPolygon({
      type: 'WKT',
      data: 'POLYGON((18.1 40.3,18.3 40.3,18.3 40.5,18.1 40.5,18.1 40.3))',
      epsg: 'EPSG:4326',
    })
    expect(polygon?.type).toBe('Polygon')
    expect(polygon?.coordinates[0].length).toBeGreaterThanOrEqual(4)
  })

  it('rejects points', () => {
    expect(clipPayloadToPolygon({ type: 'WKT', data: 'POINT(18.1 40.3)' })).toBeNull()
  })

  it('projects Web Mercator clip to WGS84', () => {
    // Lecce-ish square in EPSG:3857 (map CRS).
    const polygon = clipPayloadToPolygon({
      type: 'WKT',
      data: 'POLYGON((2014882 4906470,2037143 4906470,2037143 4935102,2014882 4935102,2014882 4906470))',
      epsg: 'EPSG:3857',
    })
    expect(polygon).not.toBeNull()
    const [lon, lat] = polygon!.coordinates[0][0]
    expect(lon).toBeGreaterThan(17)
    expect(lon).toBeLessThan(19)
    expect(lat).toBeGreaterThan(39)
    expect(lat).toBeLessThan(42)
  })
})

describe('polygonToWkt', () => {
  it('emits POLYGON WKT', () => {
    const wkt = polygonToWkt({ type: 'Polygon', coordinates: [LECCE] })
    expect(wkt.startsWith('POLYGON')).toBe(true)
    expect(wkt).toContain('18.1')
  })
})

describe('bboxFromPolygon', () => {
  it('returns envelope', () => {
    expect(bboxFromPolygon({ type: 'Polygon', coordinates: [LECCE] })).toEqual([
      18.1, 40.3, 18.3, 40.5,
    ])
  })
})
