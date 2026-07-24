/** Ported from cu1.5-fe — draw handle styling inside map-widget shadow DOM. */
const STYLE_ID = 'siv-map-draw-handle-override'

const DRAW_HANDLE_CSS = `
    .ol-overlaycontainer .ol-touch-cursor {
      width: 30px !important;
      height: 30px !important;
      margin: 4px !important;
      border-radius: 6px !important;
      box-shadow: inset 0 0 0 2px #369 !important;
    }
    .ol-overlaycontainer .ol-touch-cursor:after {
      width: 45% !important;
      height: 45% !important;
    }
    .ol-overlaycontainer .ol-touch-cursor .ol-button {
      height: 50% !important;
      width: 50% !important;
      border-radius: 4px !important;
      box-shadow: inset 0 0 0 2px currentColor !important;
    }
    .ol-overlaycontainer .ol-touch-cursor .ol-button:before {
      width: 1.05em !important;
      height: 0.8em !important;
      font-size: 1.05em !important;
    }
  `

/** Hide duplicate panels visually — never remove the live OpenLayers viewport. */
const SINGLE_MAP_PANEL_CSS = `
    .mw-maps-item.siv-map-panel-hidden {
      display: none !important;
      flex: 0 0 0 !important;
      width: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }
    .mw-maps-item.siv-map-panel-active {
      flex: 1 1 100% !important;
      flex-basis: 100% !important;
      width: 100% !important;
      max-width: 100% !important;
    }
  `

function scoreMapPanel(item: Element): number {
  const canvas = item.querySelector('.ol-viewport canvas')
  if (!canvas) return 0
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return 0
  return rect.width * rect.height
}

function pickActiveMapPanel(items: Element[]): Element | null {
  if (items.length === 0) return null
  if (items.length === 1) return items[0]

  let best = items[items.length - 1]
  let bestScore = scoreMapPanel(best)

  for (let i = items.length - 2; i >= 0; i -= 1) {
    const score = scoreMapPanel(items[i])
    if (score > bestScore) {
      best = items[i]
      bestScore = score
    }
  }

  return bestScore > 0 ? best : items[items.length - 1]
}

function injectShadowStyles(root: ShadowRoot): void {
  if (!root.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `${DRAW_HANDLE_CSS}\n${SINGLE_MAP_PANEL_CSS}`
    root.appendChild(style)
  }
}

/**
 * StrictMode leaves orphan map-widget hosts. Keep the latest mount (last in DOM).
 */
export function dedupeGeoinsightMapWidgets(): void {
  const widgets = document.querySelectorAll('map-widget')
  if (widgets.length <= 1) return

  for (let i = 0; i < widgets.length - 1; i += 1) {
    widgets[i].remove()
  }
}

/** Collapse duplicate map panels — keep the one with a live OpenLayers canvas. */
export function dedupeGeoinsightMapPanels(): void {
  dedupeGeoinsightMapWidgets()

  for (const host of document.querySelectorAll('map-widget')) {
    const root = host.shadowRoot
    if (!root) continue

    injectShadowStyles(root)

    const items = Array.from(root.querySelectorAll('.mw-maps-item'))
    if (items.length <= 1) {
      items[0]?.classList.add('siv-map-panel-active')
      items[0]?.classList.remove('siv-map-panel-hidden')
      continue
    }

    const active = pickActiveMapPanel(items)
    for (const item of items) {
      if (item === active) {
        item.classList.add('siv-map-panel-active')
        item.classList.remove('siv-map-panel-hidden')
      } else {
        item.classList.add('siv-map-panel-hidden')
        item.classList.remove('siv-map-panel-active')
      }
    }
  }

  window.dispatchEvent(new Event('resize'))
}

let mapPanelDedupeObserver: MutationObserver | null = null
let dedupeDebounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDedupeGeoinsightMapPanels(): void {
  if (dedupeDebounceTimer != null) clearTimeout(dedupeDebounceTimer)
  dedupeDebounceTimer = setTimeout(() => {
    dedupeDebounceTimer = null
    dedupeGeoinsightMapPanels()
  }, 120)
}

/** Watch shadow DOM and collapse duplicate map panels as they appear. */
export function startGeoinsightMapPanelDedupeObserver(): void {
  if (mapPanelDedupeObserver) return

  const attach = (host: Element) => {
    const root = host.shadowRoot
    if (!root) return

    scheduleDedupeGeoinsightMapPanels()

    if (mapPanelDedupeObserver) {
      mapPanelDedupeObserver.disconnect()
    }

    mapPanelDedupeObserver = new MutationObserver(() => {
      scheduleDedupeGeoinsightMapPanels()
    })
    mapPanelDedupeObserver.observe(root, { childList: true, subtree: true })
  }

  for (const host of document.querySelectorAll('map-widget')) {
    attach(host)
  }

  if (document.querySelector('map-widget')) return

  const docObserver = new MutationObserver(() => {
    const widgets = document.querySelectorAll('map-widget')
    if (widgets.length === 0) return
    docObserver.disconnect()
    for (const el of widgets) attach(el)
  })
  docObserver.observe(document.body, { childList: true, subtree: true })
}

export function injectMapDrawHandleStyles(): void {
  dedupeGeoinsightMapPanels()
  startGeoinsightMapPanelDedupeObserver()
}
