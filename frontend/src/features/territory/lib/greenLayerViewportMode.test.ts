import { describe, expect, it } from 'vitest'
import {
  resolveGreenViewportMode,
  shouldFetchAreasViewport,
} from './greenLayerViewportMode'

describe('resolveGreenViewportMode', () => {
  it('is off when clip is required and missing', () => {
    expect(
      resolveGreenViewportMode({
        assetsActive: true,
        areasActive: true,
        clipReady: false,
      }),
    ).toBe('off')
  })

  it('covers the four toggle combinations when clipReady', () => {
    expect(
      resolveGreenViewportMode({
        assetsActive: false,
        areasActive: false,
        clipReady: true,
      }),
    ).toBe('off')
    expect(
      resolveGreenViewportMode({
        assetsActive: false,
        areasActive: true,
        clipReady: true,
      }),
    ).toBe('areas_only')
    expect(
      resolveGreenViewportMode({
        assetsActive: true,
        areasActive: false,
        clipReady: true,
      }),
    ).toBe('assets')
    expect(
      resolveGreenViewportMode({
        assetsActive: true,
        areasActive: true,
        clipReady: true,
      }),
    ).toBe('assets_with_areas')
  })

  it('models key transitions toward dual and back', () => {
    const steps: Array<{
      assets: boolean
      areas: boolean
      expect: ReturnType<typeof resolveGreenViewportMode>
    }> = [
      { assets: false, areas: false, expect: 'off' },
      { assets: false, areas: true, expect: 'areas_only' },
      { assets: true, areas: true, expect: 'assets_with_areas' },
      { assets: true, areas: false, expect: 'assets' },
      { assets: false, areas: false, expect: 'off' },
      { assets: true, areas: false, expect: 'assets' },
      { assets: true, areas: true, expect: 'assets_with_areas' },
      { assets: false, areas: true, expect: 'areas_only' },
    ]
    for (const step of steps) {
      expect(
        resolveGreenViewportMode({
          assetsActive: step.assets,
          areasActive: step.areas,
          clipReady: true,
        }),
      ).toBe(step.expect)
    }
  })
})

describe('shouldFetchAreasViewport', () => {
  const minZoom = 13

  it('requires both fetcher and zoom ≥ min', () => {
    expect(shouldFetchAreasViewport(true, 12.9, minZoom)).toBe(false)
    expect(shouldFetchAreasViewport(true, 13, minZoom)).toBe(true)
    expect(shouldFetchAreasViewport(false, 18, minZoom)).toBe(false)
  })
})
