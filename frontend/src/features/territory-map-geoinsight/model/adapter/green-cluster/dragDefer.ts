import { CANVAS_SELECTOR } from './constants'

/**
 * Viewport refreshes are deferred while a map drag is in progress and coalesced
 * into a single cycle on pointer release. Each refresh allocates heavily
 * (geobuf decode, payload rebuild, vendor re-index of hundreds of geometries):
 * running several cycles mid-gesture piled up garbage until Firefox paused the
 * main thread 1-2s with a major GC, freezing the drag.
 */
let mapPointerDragActive = false
let dragDeferredApply: (() => void) | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (event) => {
      if ((event.target as HTMLElement | null)?.closest?.(CANVAS_SELECTOR)) {
        mapPointerDragActive = true
      }
    },
    { capture: true, passive: true }
  )
  const releaseDrag = () => {
    mapPointerDragActive = false
    const run = dragDeferredApply
    dragDeferredApply = null
    run?.()
  }
  window.addEventListener('pointerup', releaseDrag, { capture: true, passive: true })
  window.addEventListener('pointercancel', releaseDrag, { capture: true, passive: true })
}

export function isMapPointerDragActive(): boolean {
  return mapPointerDragActive
}

export function deferApplyUntilPointerRelease(run: () => void): void {
  dragDeferredApply = run
}
