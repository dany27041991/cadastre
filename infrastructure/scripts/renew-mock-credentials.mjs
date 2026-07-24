#!/usr/bin/env node
/**
 * Replace VITE_MOCK_FGP and VITE_MOCK_COOKIE in compose .env (and frontend/.env.local).
 *
 * Source of truth for renewal: POST https://sim-dev.mase.gov.it/core/api/authorization/user/logged (200)
 * → Request Headers: `fgp` and `Cookie` (Copy value, not truncated summary).
 *
 * Usage:
 *   node renew-mock-credentials.mjs --fgp <uuid> --cookie '<name=value; ...>'
 *   echo '{"fgp":"...","cookie":"..."}' | node renew-mock-credentials.mjs
 *   node renew-mock-credentials.mjs --file /tmp/mase-creds.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const composeEnv = path.resolve(__dirname, '../compose/.env')
const frontendEnvLocal = path.resolve(__dirname, '../../frontend/.env.local')

function parseArgs(argv) {
  const out = { fgp: '', cookie: '', file: '' }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--fgp') out.fgp = argv[++i] ?? ''
    else if (arg === '--cookie') out.cookie = argv[++i] ?? ''
    else if (arg === '--file') out.file = argv[++i] ?? ''
  }
  return out
}

async function readInput(args) {
  if (args.file) {
    const raw = fs.readFileSync(args.file, 'utf8')
    return JSON.parse(raw)
  }
  if (args.fgp && args.cookie) {
    return { fgp: args.fgp, cookie: args.cookie }
  }
  if (!process.stdin.isTTY) {
    const raw = await fs.promises.readFile(0, 'utf8')
    return JSON.parse(raw)
  }
  throw new Error('Provide --fgp + --cookie, --file, or JSON on stdin: {"fgp":"...","cookie":"..."}')
}

function jwtExp(token) {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof json.exp === 'number' ? new Date(json.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}

function escapeEnvQuotedValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function replaceEnvLine(content, key, value, quoted = false) {
  const line = quoted ? `${key}="${escapeEnvQuotedValue(value)}"` : `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(content)) return content.replace(re, line)
  return `${content.trimEnd()}\n${line}\n`
}

function updateEnvFile(filePath, fgp, cookie) {
  if (!fs.existsSync(filePath)) return false
  let content = fs.readFileSync(filePath, 'utf8')
  content = replaceEnvLine(content, 'VITE_MOCK_FGP', fgp, false)
  content = replaceEnvLine(content, 'VITE_MOCK_COOKIE', cookie, true)
  fs.writeFileSync(filePath, content)
  return true
}

const args = parseArgs(process.argv)
const { fgp, cookie } = await readInput(args)

if (!fgp?.trim()) throw new Error('fgp is required')
if (!cookie?.trim()) throw new Error('cookie is required')

updateEnvFile(composeEnv, fgp.trim(), cookie.trim())
const syncedLocal = updateEnvFile(frontendEnvLocal, fgp.trim(), cookie.trim())

const accessMatch = cookie.match(/access_token=([^;]+)/)
const exp = accessMatch ? jwtExp(accessMatch[1]) : null

console.log(`Updated ${composeEnv}`)
if (syncedLocal) console.log(`Updated ${frontendEnvLocal}`)
if (exp) console.log(`access_token expires: ${exp}`)
else console.log('Could not parse access_token exp from cookie string')
