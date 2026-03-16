/**
 * Bootstrap per utenza mockata in modalità standalone (es. compose senza shell).
 * Legge VITE_MOCK_FGP, VITE_MOCK_USER, VITE_MOCK_COOKIE e imposta sessionStorage,
 * store utente e (se possibile) cookie. Solo per sviluppo/test.
 */
import type { AuthUser } from '@/app/store'
import { useAuthStore } from '@/app/store'

const FGP_KEY = 'fgp'

function applyMockFgp(): void {
  const fgp = import.meta.env.VITE_MOCK_FGP
  if (typeof fgp === 'string' && fgp.trim()) {
    try {
      sessionStorage.setItem(FGP_KEY, fgp.trim())
      if (import.meta.env.DEV) {
        console.info('[mockAuth] FGP impostato da VITE_MOCK_FGP (standalone)')
      }
    } catch (e) {
      console.warn('[mockAuth] Impossibile impostare sessionStorage fgp:', e)
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
      if (import.meta.env.DEV) {
        console.info('[mockAuth] Utente mock impostato da VITE_MOCK_USER (standalone)')
      }
    }
  } catch (e) {
    console.warn('[mockAuth] VITE_MOCK_USER non è un JSON valido:', e)
  }
}

/**
 * Imposta cookie da stringa in formato header Cookie (name=value; name2=value2).
 * Nota: cookie httpOnly non sono impostabili da JS; in dev il backend può accettare
 * comunque session/token per testing.
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
    if (import.meta.env.DEV && parts.length > 0) {
      console.info('[mockAuth] Cookie mock impostati da VITE_MOCK_COOKIE (standalone)', parts.length, 'cookie')
    }
  } catch (e) {
    console.warn('[mockAuth] Errore impostazione cookie mock:', e)
  }
}

/** Esegue il bootstrap delle credenziali mock se le variabili d’ambiente sono definite. */
export function initMockAuth(): void {
  applyMockFgp()
  applyMockUser()
  applyMockCookie()
}
