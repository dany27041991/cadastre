import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  enableGreenFiltersDebugForTests,
  getGreenFilterDebugLogs,
  getGreenFilterDebugLogsByChannel,
  isGreenFiltersDebug,
  logGreenFilter,
  nextGreenFilterCorrelationId,
  resetGreenFiltersDebug,
} from './greenFiltersDebug'

describe('greenFiltersDebug', () => {
  const originalEnv = import.meta.env.VITE_DEBUG_GREEN_FILTERS

  beforeEach(() => {
    resetGreenFiltersDebug()
    // @ts-expect-error test override
    import.meta.env.VITE_DEBUG_GREEN_FILTERS = undefined
  })

  afterEach(() => {
    resetGreenFiltersDebug()
    // @ts-expect-error restore
    import.meta.env.VITE_DEBUG_GREEN_FILTERS = originalEnv
  })

  it('is off by default', () => {
    expect(isGreenFiltersDebug()).toBe(false)
  })

  it('turns on via VITE_DEBUG_GREEN_FILTERS', () => {
    // @ts-expect-error test override
    import.meta.env.VITE_DEBUG_GREEN_FILTERS = '1'
    expect(isGreenFiltersDebug()).toBe(true)
  })

  it('does not log when disabled', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logGreenFilter('FILTER', 'noop', { x: 1 })
    expect(spy).not.toHaveBeenCalled()
    expect(getGreenFilterDebugLogs()).toHaveLength(0)
    spy.mockRestore()
  })

  it('logs when enabled and correlation ids are unique', () => {
    // @ts-expect-error test override
    import.meta.env.VITE_DEBUG_GREEN_FILTERS = '1'
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const a = nextGreenFilterCorrelationId()
    const b = nextGreenFilterCorrelationId()
    expect(a).not.toEqual(b)
    logGreenFilter('FILTER', 'toggle', { correlationId: a })
    expect(spy).toHaveBeenCalled()
    expect(getGreenFilterDebugLogsByChannel('FILTER')).toHaveLength(1)
    spy.mockRestore()
  })

  it('enableGreenFiltersDebugForTests forces ON and captures sink', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    enableGreenFiltersDebugForTests()
    expect(isGreenFiltersDebug()).toBe(true)
    logGreenFilter('MAP_VIEWPORT', 'refresh', { zoom: 12 })
    logGreenFilter('TABLE', 'fetch start', { kind: 'area' })
    const logs = getGreenFilterDebugLogs()
    expect(logs).toHaveLength(2)
    expect(logs[0]?.channel).toBe('MAP_VIEWPORT')
    expect(logs[1]?.channel).toBe('TABLE')
    expect(logs[0]?.ts).toBeTypeOf('number')
    resetGreenFiltersDebug()
    expect(isGreenFiltersDebug()).toBe(false)
    expect(getGreenFilterDebugLogs()).toHaveLength(0)
    spy.mockRestore()
  })
})
