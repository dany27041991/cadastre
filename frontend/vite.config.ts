import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'
import { patchGeoinsightBundleSource } from './src/vendor/patchGeoinsightBundle'

/** AMD bundle must bypass Vite transform — script tag needs raw define(), not ESM export. */
const GEOINSIGHT_BUNDLE_FILE = 'vendor/mase-commons-geoinsight.js'
const GEOINSIGHT_BUNDLE_URL = `/${GEOINSIGHT_BUNDLE_FILE}`

function geoinsightRawBundlePlugin(): Plugin {
  const publicBundlePath = path.resolve(__dirname, 'public/vendor/mase-commons-geoinsight.js')
  const nodeModulesBundlePath = path.resolve(
    __dirname,
    'node_modules/@mase/commons-geoinsight/dist/mase-commons-geoinsight.js'
  )

  const resolveBundlePath = (): string | null => {
    const publicSize = fs.existsSync(publicBundlePath) ? fs.statSync(publicBundlePath).size : 0
    const nodeModulesSize = fs.existsSync(nodeModulesBundlePath)
      ? fs.statSync(nodeModulesBundlePath).size
      : 0
    // Full bundle is ~6.5MB; truncated npm installs in Docker volumes were ~4.2MB.
    if (publicSize >= 6_000_000) return publicBundlePath
    if (nodeModulesSize >= 6_000_000) return nodeModulesBundlePath
    if (publicSize > nodeModulesSize && publicSize > 0) return publicBundlePath
    if (nodeModulesSize > 0) return nodeModulesBundlePath
    return null
  }

  return {
    name: 'geoinsight-raw-bundle',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== GEOINSIGHT_BUNDLE_URL) {
          next()
          return
        }
        const bundlePath = resolveBundlePath()
        if (!bundlePath) {
          res.statusCode = 404
          res.end('Geoinsight bundle not found — run npm install with VPN')
          return
        }
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store, must-revalidate')
        const patched = patchGeoinsightBundleSource(fs.readFileSync(bundlePath))
        res.end(patched)
      })
    },
    generateBundle() {
      const bundlePath = resolveBundlePath()
      if (!bundlePath) return
      this.emitFile({
        type: 'asset',
        fileName: GEOINSIGHT_BUNDLE_FILE,
        source: patchGeoinsightBundleSource(fs.readFileSync(bundlePath)),
      })
    },
  }
}

/**
 * Offline cache for the MASE/Geoinsight proxy (dev only).
 *
 * Every good upstream response (config, TOC layers, map tiles at any zoom) is
 * persisted to disk; when sim-dev fails (Master Catalog 500, VPN down, network
 * error) the proxy replays the last good response so the map keeps working.
 * The cache warms up as you use the map: tiles are stored per URL, so every
 * zoom level you visit while sim-dev is up becomes available offline.
 */
const GEOINSIGHT_CACHE_DIR = path.resolve(__dirname, 'node_modules/.geoinsight-cache')
/** Per-response cap: tiles are 10-500KB, config <1MB; skip anything unexpected. */
const GEOINSIGHT_CACHE_MAX_BODY_BYTES = 8 * 1024 * 1024
/** Response headers worth replaying (never set-cookie). */
const GEOINSIGHT_CACHE_HEADERS = ['content-type', 'content-encoding'] as const

interface MaseCachedRequest extends IncomingMessage {
  maseCacheKey?: string
}

function maseCachePaths(key: string): { meta: string; body: string } {
  const hash = crypto.createHash('sha1').update(key).digest('hex')
  return {
    meta: path.join(GEOINSIGHT_CACHE_DIR, `${hash}.json`),
    body: path.join(GEOINSIGHT_CACHE_DIR, `${hash}.bin`),
  }
}

function writeMaseCache(
  key: string,
  status: number,
  headers: Record<string, string | string[] | undefined>,
  body: Buffer
): void {
  try {
    fs.mkdirSync(GEOINSIGHT_CACHE_DIR, { recursive: true })
    const { meta, body: bodyPath } = maseCachePaths(key)
    const keptHeaders: Record<string, string> = {}
    for (const name of GEOINSIGHT_CACHE_HEADERS) {
      const value = headers[name]
      if (typeof value === 'string') keptHeaders[name] = value
    }
    fs.writeFileSync(bodyPath, body)
    fs.writeFileSync(meta, JSON.stringify({ key, status, headers: keptHeaders }))
  } catch {
    // Cache write failures must never break the live proxy path.
  }
}

function readMaseCache(
  key: string
): { status: number; headers: Record<string, string>; body: Buffer } | null {
  try {
    const { meta, body } = maseCachePaths(key)
    if (!fs.existsSync(meta) || !fs.existsSync(body)) return null
    const parsed = JSON.parse(fs.readFileSync(meta, 'utf8')) as {
      status: number
      headers: Record<string, string>
    }
    return { status: parsed.status, headers: parsed.headers, body: fs.readFileSync(body) }
  } catch {
    return null
  }
}

function sendMaseResponse(
  res: ServerResponse,
  status: number,
  headers: Record<string, string | string[] | undefined>,
  body: Buffer,
  cacheState: 'live' | 'stale'
): void {
  if (res.headersSent) {
    res.end()
    return
  }
  for (const name of GEOINSIGHT_CACHE_HEADERS) {
    const value = headers[name]
    if (typeof value === 'string') res.setHeader(name, value)
  }
  res.setHeader('content-length', String(body.length))
  res.setHeader('x-geoinsight-cache', cacheState)
  res.statusCode = status
  res.end(body)
}

function createMaseProxy(target: string, cookie?: string, fgp?: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: false,
    // Fail fast when VPN/sim-dev is unreachable so the disk cache can kick in
    // instead of hanging the browser fetch until TCP timeout (white screen).
    timeout: 5_000,
    proxyTimeout: 5_000,
    // Responses are buffered so failures can be swapped with the cached copy.
    selfHandleResponse: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req: MaseCachedRequest) => {
        if (cookie) proxyReq.setHeader('Cookie', cookie)
        if (fgp) proxyReq.setHeader('fgp', fgp)
        // Only GETs are safely keyed by URL (POST bodies would collide).
        if (req.method === 'GET') req.maseCacheKey = `GET ${req.url}`
      })
      proxy.on('proxyRes', (proxyRes, req: MaseCachedRequest, res) => {
        const chunks: Buffer[] = []
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks)
          const status = proxyRes.statusCode ?? 502
          const key = req.maseCacheKey
          if (status < 400) {
            if (
              key != null &&
              status === 200 &&
              body.length > 0 &&
              body.length <= GEOINSIGHT_CACHE_MAX_BODY_BYTES
            ) {
              writeMaseCache(key, status, proxyRes.headers, body)
            }
            sendMaseResponse(res, status, proxyRes.headers, body, 'live')
            return
          }
          const cached = key != null ? readMaseCache(key) : null
          if (cached) {
            console.warn(`[geoinsight-cache] upstream ${status}, serving cached: ${key}`)
            sendMaseResponse(res, cached.status, cached.headers, cached.body, 'stale')
            return
          }
          sendMaseResponse(res, status, proxyRes.headers, body, 'live')
        })
      })
      proxy.on('error', (err, req: MaseCachedRequest, res) => {
        const key = req.maseCacheKey
        const cached = key != null ? readMaseCache(key) : null
        const serverRes = res as ServerResponse
        if (cached && typeof serverRes.setHeader === 'function') {
          console.warn(`[geoinsight-cache] upstream unreachable (${err.message}), serving cached: ${key}`)
          sendMaseResponse(serverRes, cached.status, cached.headers, cached.body, 'stale')
          return
        }
        console.warn(
          `[geoinsight-cache] upstream unreachable (${err.message}), no cache for: ${key ?? req.url}`
        )
        if (typeof serverRes.end === 'function' && !serverRes.headersSent) {
          serverRes.statusCode = 502
          serverRes.end('Geoinsight proxy error and no cached copy available')
        }
      })
    },
  }
}

function readViteEnv(key: string, env: Record<string, string>): string {
  const fromFile = env[key]?.trim() ?? ''
  if (fromFile) return fromFile
  return process.env[key]?.trim() ?? ''
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const maseTarget =
    readViteEnv('VITE_MASE_API_ORIGIN', env) || 'https://sim-dev.mase.gov.it'
  const proxyCookie = readViteEnv('VITE_MOCK_COOKIE', env).replace(/^"|"$/g, '')
  const proxyFgp = readViteEnv('VITE_MOCK_FGP', env)

  if (mode === 'development' && !proxyCookie) {
    console.warn(
      '[vite] VITE_MOCK_COOKIE missing — Geoinsight proxy requests may return 500. ' +
        'Set credentials in frontend/.env.local or compose .env, then restart Vite.'
    )
  }

  return {
    plugins: [react(), geoinsightRawBundlePlugin()],
    define: {
      'import.meta.env.VITE_STANDALONE': JSON.stringify('true'),
    },
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, 'src') },
        {
          find: /^@mase\/commons-geoinsight$/,
          replacement: path.resolve(__dirname, 'src/vendor/mase-commons-geoinsight.ts'),
        },
      ],
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    optimizeDeps: {
      exclude: ['@mase/commons-geoinsight'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/core/api/geoinsight': createMaseProxy(maseTarget, proxyCookie, proxyFgp),
        '/core/api/integrationlogic': createMaseProxy(maseTarget, proxyCookie, proxyFgp),
        // env.json is served from public/portalediaccesso/env.json (no VPN required).
        '/portalediaccesso/common-labels.json': createMaseProxy(maseTarget, proxyCookie, proxyFgp),
        '/portalediaccesso/commons/geoinsight': createMaseProxy(maseTarget, proxyCookie, proxyFgp),
      },
    },
  }
})
