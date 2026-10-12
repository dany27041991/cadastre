import { describe, expect, it } from 'vitest'
import { viewportBboxMovedEnough, viewportBboxShiftRatio } from './mapViewportBbox'

describe('viewportBboxMovedEnough', () => {
  const prev: [number, number, number, number] = [11.7, 42.2, 11.8, 42.3]

  it('detects significant pan shift', () => {
    const next: [number, number, number, number] = [11.85, 42.2, 11.95, 42.3]
    expect(viewportBboxShiftRatio(prev, next)).toBeGreaterThan(0.5)
    expect(viewportBboxMovedEnough(prev, next)).toBe(true)
  })

  it('ignores tiny jitter', () => {
    const next: [number, number, number, number] = [11.701, 42.201, 11.801, 42.301]
    expect(viewportBboxMovedEnough(prev, next)).toBe(false)
  })

  it('detects zoom-out with fixed center (extent grows)', () => {
    // Same center as prev (11.75, 42.25), ~2x linear extent → area ~4x.
    const next: [number, number, number, number] = [11.65, 42.15, 11.85, 42.35]
    expect(viewportBboxShiftRatio(prev, next)).toBeLessThan(0.05)
    expect(viewportBboxMovedEnough(prev, next)).toBe(true)
  })
})
