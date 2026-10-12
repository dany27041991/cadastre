import { describe, expect, it } from 'vitest'
import { clusterCircleSizePx, clusterRadiusMeters } from './clusterCircleGeometry'

describe('clusterCircleSizePx', () => {
  it('grows monotonically with member count', () => {
    const sizes = [2, 5, 10, 50, 200, 2000, 8000].map(clusterCircleSizePx)
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!)
    }
  })

  it('keeps small and large clusters visibly different', () => {
    const small = clusterCircleSizePx(3)
    const medium = clusterCircleSizePx(40)
    const large = clusterCircleSizePx(800)
    expect(medium).toBeGreaterThan(small * 1.4)
    expect(large).toBeGreaterThan(medium * 1.2)
  })

  it('scales ground radius with member count at fixed zoom', () => {
    const z = 12
    const rSmall = clusterRadiusMeters(5, z)
    const rLarge = clusterRadiusMeters(500, z)
    expect(rLarge).toBeGreaterThan(rSmall * 2)
  })
})
