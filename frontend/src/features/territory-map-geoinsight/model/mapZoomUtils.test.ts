import { describe, expect, it } from 'vitest'
import { nextClusterDrillZoom } from './mapZoomUtils'

describe('nextClusterDrillZoom', () => {
  it('jumps past region → province threshold', () => {
    expect(nextClusterDrillZoom(5)).toBeCloseTo(8.15)
    expect(nextClusterDrillZoom(7.9)).toBeCloseTo(8.15)
  })

  it('jumps past province → municipality threshold', () => {
    expect(nextClusterDrillZoom(8)).toBeCloseTo(12.15)
    expect(nextClusterDrillZoom(11.5)).toBeCloseTo(12.15)
  })

  it('jumps past municipality → grid threshold', () => {
    expect(nextClusterDrillZoom(12)).toBeCloseTo(13.15)
    expect(nextClusterDrillZoom(12.5)).toBeCloseTo(13.15)
  })

  it('jumps past grid → raw threshold', () => {
    expect(nextClusterDrillZoom(13)).toBeCloseTo(19.15)
    expect(nextClusterDrillZoom(17)).toBeCloseTo(19.15)
  })

  it('steps further when already at raw zoom', () => {
    expect(nextClusterDrillZoom(19)).toBeGreaterThan(19)
  })
})
