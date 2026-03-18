/**
 * Bootstrap mock auth in standalone mode (e.g. compose without shell).
 * Reads VITE_MOCK_FGP, VITE_MOCK_USER, VITE_MOCK_COOKIE and sets sessionStorage,
 * user store and (where possible) document cookies. Dev/test only.
 */
import type { AuthUser } from '@/app/store'
import { useAuthStore } from '@/app/store'

const FGP_KEY = 'fgp'

function applyMockFgp(): void {
  const fgp = import.meta.env.VITE_MOCK_FGP
  if (typeof fgp === 'string' && fgp.trim()) {
    try {
      sessionStorage.setItem(FGP_KEY, fgp.trim())
    } catch {
      /* sessionStorage unavailable */
    }
  }
}

function applyMockUser(): void {
  const raw = import.meta.env.VITE_MOCK_USER
  if (typeof raw !== 'string' || !raw.trim()) return
  try {
    const user = JSON.parse(raw) as AuthUser
    if (user && typeof user === 'object') {
      useAuthStore.getState().setUser(user)
    }
  } catch {
    /* invalid JSON */
  }
}

/**
 * Parse a Cookie header string (name=value; name2=value2).
 * Note: httpOnly cookies cannot be set from JS; in dev the backend may still accept session/token for testing.
 */
function applyMockCookie(): void {
  const cookieString = import.meta.env.VITE_MOCK_COOKIE
  if (typeof cookieString !== 'string' || !cookieString.trim()) return
  try {
    const parts = cookieString.split(/\s*;\s*/).filter(Boolean)
    for (const part of parts) {
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const name = part.slice(0, eq).trim()
      const value = part.slice(eq + 1).trim()
      if (!name) continue
      document.cookie = `${name}=${value}; path=/; SameSite=Lax`
    }
  } catch {
    /* document.cookie unavailable */
  }
}

/** Run mock credential bootstrap when the corresponding env vars are set. */
export function initMockAuth(): void {
  applyMockFgp()
  applyMockUser()
  applyMockCookie()
}
