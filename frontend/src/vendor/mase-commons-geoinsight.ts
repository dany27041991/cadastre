/**
 * Vite standalone loader for @mase/commons-geoinsight (AMD bundle, same package as cu1.5-fe).
 * In MASE shell / webpack build the real package is externalized by single-spa (no loader).
 *
 * Standalone dev: proxies /core and /portalediaccesso to sim-dev (see vite.config.ts) and calls
 * real Geoinsight REST endpoints instead of empty stubs.
 */
import * as React from 'react'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { STANDALONE_GEOINSIGHT_ENDPOINTS } from './geoinsightStandaloneEndpoints'

export interface GeoinsightRef {
  getCenterAndScale?: (mapId: number) => {
    epsg?: string
    zoom?: number
    level?: number
    scale?: number
    center?: number[]
  } | undefined
  addGeometries?: (mapId: number, geometries: unknown[]) => void
  removeGeometries?: (mapId: number, geomIds: string[]) => void
  zoomToBBOX?: (mapId: number, options: { epsg: string; bbox: number[] }) => void
  zoomToPoint?: (mapId: number, coordinates: number[], epsg: string, scale?: number) => void
  deactivateDrawGeometry?: (mapId: number) => void
  activateDrawnGeometryInfo?: (mapId: number) => void
  deactivateDrawnGeometryInfo?: (mapId: number) => void
  setGeometryLabelVisibility?: (mapId: number, visible: boolean) => void
  setMapVisible?: (mapId: number, visible: boolean) => void | Promise<void>
  setMapActive?: (mapId: number) => void
}

type GeoinsightComponent = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<GeoinsightRef>
>

export type UseRefGeoinsight = (mode?: string) => {
  ref: React.RefObject<GeoinsightRef | null>
}

export interface GeoinsightModule {
  Geoinsight: GeoinsightComponent
  useRefGeoinsight: UseRefGeoinsight
}

declare global {
  interface Window {
    define?: AmdDefine
  }
}

type AmdDefine = {
  (deps: string[], factory: (...args: unknown[]) => void): void
  amd?: boolean
}

type EnvJson = Record<string, unknown>

/** Served raw by geoinsightRawBundlePlugin (vite.config.ts) — not via Vite module graph. */
const geoinsightBundleUrl = '/vendor/mase-commons-geoinsight.js'

function geoinsightScriptUrl(): string {
  if (import.meta.env.DEV) {
    return `${geoinsightBundleUrl}?v=6776216`
  }
  return geoinsightBundleUrl
}

const GEOINSIGHT_TOC_LAYERS = '/core/api/geoinsight/v1/webgis/config/toc_layers'
const GEOINSIGHT_SERVICES = '/core/api/geoinsight/v1/webgis/config/services'
const ENV_JSON_PATH = '/portalediaccesso/env.json'

let modulePromise: Promise<GeoinsightModule> | null = null
let resolvedModule: GeoinsightModule | null = null
let envJson: EnvJson | null = null

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const fgp =
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fgp') : null) ??
    import.meta.env.VITE_MOCK_FGP?.trim() ??
    ''
  if (fgp) headers.fgp = fgp
  return headers
}

function parseGeoinsightErrorMessage(body: string): string {
  try {
    const payload = JSON.parse(body) as { message?: unknown; details?: unknown }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
  } catch {
    /* not JSON */
  }
  return body.slice(0, 200).trim()
}

async function geoinsightApiGet(
  path: string,
  params: { webgis_id: number; cu_id: string }
): Promise<{ data: unknown }> {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('webgis_id', String(params.webgis_id))
  url.searchParams.set('cu_id', params.cu_id)

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const apiMessage = parseGeoinsightErrorMessage(body)

    const userHint =
      apiMessage.includes('User is missing') || apiMessage.includes('missing')
        ? 'Credenziali mock assenti o scadute: aggiornare VITE_MOCK_FGP/VITE_MOCK_COOKIE e riavviare Vite.'
        : 'Verificare VPN sim-dev e credenziali mock, poi riavviare il dev server.'

    useGeoinsightStore.getState().setInitError(`${apiMessage} ${userHint}`)

    console.error(
      `[geoinsight-loader] ${path} failed (${response.status}) webgis_id=${params.webgis_id} cu_id=${params.cu_id}`,
      body.slice(0, 300)
    )
    throw new Error(`Geoinsight API ${response.status}: ${path} — ${apiMessage}`)
  }

  const payload = await response.json()
  useGeoinsightStore.getState().setInitError(null)
  const data =
    payload != null && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload
  return { data }
}

async function loadEnvJson(): Promise<EnvJson> {
  if (envJson) return envJson
  try {
    const response = await fetch(ENV_JSON_PATH, { credentials: 'include' })
    if (!response.ok) throw new Error(String(response.status))
    envJson = (await response.json()) as EnvJson
  } catch (error) {
    console.warn('[geoinsight-loader] env.json unavailable, using defaults', error)
    envJson = {
      baseContext: '/portalediaccesso',
      geoinsight: { cesiumPath: '/commons/geoinsight' },
    }
  }
  return envJson
}

function readEnvValue(key: string): string {
  if (!envJson) return ''
  const parts = key.split('.')
  let current: unknown = envJson
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return ''
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : ''
}

/** Standalone endpoint map — must include all bundle keys (endpointStore.init replaces defaults). */
function createStandaloneApiEndpoints(): Record<string, { url: string }> {
  return { ...STANDALONE_GEOINSIGHT_ENDPOINTS }
}

function createCommonsClientApi(): Record<string, unknown> {
  const endpoints = createStandaloneApiEndpoints()
  const webgis = (params: { webgis_id: number; cu_id: string }) =>
    geoinsightApiGet(GEOINSIGHT_TOC_LAYERS, params)
  const gisServices = (params: { webgis_id: number; cu_id: string }) =>
    geoinsightApiGet(GEOINSIGHT_SERVICES, params)

  // Bundle: Co = commonsClient.GeoinsightClient → map-widget api_endpoints (endpoint store).
  return {
    GeoinsightClient: endpoints,
    webgis,
    gisServices,
  }
}

type MapWidgetVueProxy = {
  setWebgisConfigs?: (config: unknown) => void
  viewerStore?: { mapsStore?: unknown[]; reset?: () => void }
}

type MapWidgetHost = HTMLElement & {
  api_endpoints?: unknown
  __sgiWebgisInitPatched?: boolean
}

/** Reset viewerStore before re-init (StrictMode / duplicate webgis_config). */
function patchMapWidgetSetWebgisConfigs(host: MapWidgetHost): void {
  if (host.__sgiWebgisInitPatched) return

  const vm = (host as unknown as { _instance?: { proxy?: MapWidgetVueProxy } })._instance?.proxy
  const original = vm?.setWebgisConfigs
  if (!vm || typeof original !== 'function') {
    window.setTimeout(() => patchMapWidgetSetWebgisConfigs(host), 50)
    return
  }

  vm.setWebgisConfigs = (config: unknown) => {
    const store = vm.viewerStore
    if (store?.mapsStore && store.mapsStore.length > 0) {
      store.reset?.()
    }
    original.call(vm, config)
  }
  host.__sgiWebgisInitPatched = true
}

function wrapMapWidgetConnectedCallback(
  proto: HTMLElement & { connectedCallback?: () => void }
): void {
  const originalConnected = proto.connectedCallback
  proto.connectedCallback = function (this: MapWidgetHost) {
    this.api_endpoints = createStandaloneApiEndpoints()
    originalConnected?.call(this)
    window.requestAnimationFrame(() => patchMapWidgetSetWebgisConfigs(this))
  }
}

/** Set api_endpoints before Vue init; guard duplicate setWebgisConfigs. */
function installMapWidgetSingleInitGuard(): void {
  if (typeof customElements === 'undefined') return

  const originalDefine = customElements.define.bind(customElements)
  customElements.define = (
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions
  ) => {
    if (name === 'map-widget') {
      wrapMapWidgetConnectedCallback(constructor.prototype as HTMLElement)
    }
    originalDefine(name, constructor, options)
  }

  const existing = customElements.get('map-widget')
  if (existing) {
    wrapMapWidgetConnectedCallback(existing.prototype as HTMLElement)
  }
}

function createCommonsEventStub(): Record<string, unknown> {
  return {
    wait: (element: unknown) => {
      if (element == null || typeof customElements === 'undefined') return
      const el = element as HTMLElement
      if (el.tagName?.toLowerCase() !== 'map-widget') return
      void customElements.whenDefined('map-widget').catch(() => undefined)
    },
  }
}

function createCommonsUtilityApi(): Record<string, unknown> {
  return {
    baseContext: typeof envJson?.baseContext === 'string' ? envJson.baseContext : '/portalediaccesso',
    envValue: readEnvValue,
    HEIGHT_BODY: '100vh',
  }
}

function createMaseStub(name: string): Record<string, unknown> {
  if (name === '@mase/commons-utility') return createCommonsUtilityApi()
  if (name === '@mase/commons-client') return createCommonsClientApi()
  if (name === '@mase/commons-event') return createCommonsEventStub()
  console.warn(`[geoinsight-loader] stub AMD dep: ${name}`)
  return {}
}

function installAmdDefine(onReady: (mod: GeoinsightModule) => void): void {
  if (typeof window === 'undefined') return

  window.define = ((deps: string[], factory: (...args: unknown[]) => void) => {
    const exports: Record<string, unknown> = {}
    const resolved = deps.map((dep) => {
      if (dep === 'exports') return exports
      if (dep === 'react') return React
      if (dep.startsWith('@mase/')) return createMaseStub(dep)
      throw new Error(`[geoinsight-loader] unsupported AMD dependency: ${dep}`)
    })
    factory(...resolved)
    const mod = exports as unknown as GeoinsightModule
    resolvedModule = mod
    onReady(mod)
  }) as AmdDefine
  window.define.amd = true
}

function loadGeoinsightScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (document.querySelector('script[data-geoinsight-bundle="true"]')) return Promise.resolve()

  installMapWidgetSingleInitGuard()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = geoinsightScriptUrl()
    script.async = true
    script.dataset.geoinsightBundle = 'true'
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error(`Failed to load Geoinsight bundle from ${geoinsightBundleUrl}`))
    document.head.appendChild(script)
  })
}

export function initGeoinsightModule(): Promise<GeoinsightModule> {
  if (resolvedModule) return Promise.resolve(resolvedModule)
  if (!modulePromise) {
    modulePromise = loadEnvJson()
      .then(() => {
        return new Promise<GeoinsightModule>((resolve, reject) => {
          installAmdDefine(resolve)
          loadGeoinsightScript().catch(reject)
        })
      })
      .catch((error) => {
        modulePromise = null
        throw error
      })
  }
  return modulePromise
}

export function getGeoinsightModule(): GeoinsightModule {
  if (!resolvedModule) {
    throw new Error('Geoinsight not initialized — await initGeoinsightModule() before render')
  }
  return resolvedModule
}

export function useRefGeoinsight(mode?: string) {
  return getGeoinsightModule().useRefGeoinsight(mode)
}

export const Geoinsight = React.forwardRef<GeoinsightRef, Record<string, unknown>>(
  function GeoinsightProxy(props, ref) {
    const Component = getGeoinsightModule().Geoinsight
    return React.createElement(Component, { ...props, ref })
  }
) as GeoinsightComponent
