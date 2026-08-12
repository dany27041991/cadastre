import { describe, expect, it } from 'vitest'
import {
  extractGeomIdFromFeatureInfo,
  pickBestGeomIdForGreenDrill,
} from './eventBridge'

describe('eventBridge', () => {
  it('extracts geom_id from feature properties', () => {
    const geomId = extractGeomIdFromFeatureInfo({
      properties: { geom_id: 'GA_99' },
    })
    expect(geomId).toBe('GA_99')
  })

  it('prefers smaller green area over expanded parent on drill', () => {
    const features = {
      type: 'FeatureCollection',
      features: [
        { properties: { geom_id: 'GA_100' } },
        { properties: { geom_id: 'GA_200' } },
      ],
    }
    const pick = pickBestGeomIdForGreenDrill(
      features,
      {
        resolveGeomId: (geomId) => {
          if (geomId === 'GA_100') {
            return {
              geomId,
              id: 100,
              layerKind: 'green_area',
              bbox: [0, 0, 10, 10],
            }
          }
          if (geomId === 'GA_200') {
            return {
              geomId,
              id: 200,
              layerKind: 'green_area',
              bbox: [0, 0, 2, 2],
            }
          }
          return undefined
        },
        excludeAreaIds: [100],
      },
      [100]
    )
    expect(pick?.geomId).toBe('GA_200')
  })

  it('prefers cluster over green area on drill', () => {
    const features = {
      type: 'FeatureCollection',
      features: [
        { properties: { geom_id: 'GA_100' } },
        { properties: { geom_id: 'GC_10_0' } },
      ],
    }
    const pick = pickBestGeomIdForGreenDrill(
      features,
      {
        resolveGeomId: (geomId) => {
          if (geomId === 'GA_100') {
            return { geomId, id: 100, layerKind: 'green_area', bbox: [0, 0, 10, 10] }
          }
          if (geomId === 'GC_10_0') {
            return { geomId, id: 0, layerKind: 'cluster', bbox: [1, 1, 2, 2] }
          }
          return undefined
        },
        excludeAreaIds: [],
      },
      []
    )
    expect(pick?.geomId).toBe('GC_10_0')
  })

  it('prefers green asset over green area when both are under the click', () => {
    const features = {
      type: 'FeatureCollection',
      features: [
        { properties: { geom_id: 'GA_100' } },
        { properties: { geom_id: 'GS_9' } },
      ],
    }
    const pick = pickBestGeomIdForGreenDrill(
      features,
      {
        resolveGeomId: (geomId) => {
          if (geomId === 'GA_100') {
            return { geomId, id: 100, layerKind: 'green_area', bbox: [0, 0, 10, 10] }
          }
          if (geomId === 'GS_9') {
            return { geomId, id: 9, layerKind: 'green_asset', bbox: [5, 5, 5, 5] }
          }
          return undefined
        },
        excludeAreaIds: [],
      },
      []
    )
    expect(pick?.geomId).toBe('GS_9')
    expect(pick?.pickedReason).toBe('green-asset-over-area')
  })
})
