/**
 * Authenticated fetch: FGP header (sessionStorage) + cookies (credentials: 'include').
 * Usato per le chiamate API quando il microfrontend è integrato nello shell MASE.
 * Nessun JWT: solo FGP + cookie di sessione.
 */
const FGP_KEY = 'fgp'

function getFgp(): string {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(FGP_KEY) ?? ''
}

/**
 * Restituisce una fetch che invia header `fgp` e i cookie di sessione.
 * Compatibile con FetcherOptions.fetchFn (url: string) => Promise<Response>.
 * Optional RequestInit (e.g. signal) is merged; credentials stay include.
 */
export function createAuthFetch(): (
  url: string,
  init?: RequestInit
) => Promise<Response> {
  return (url: string, init?: RequestInit) => {
    const fgp = getFgp()
    const headers = new Headers(init?.headers)
    if (fgp) headers.set('fgp', fgp)
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers,
    })
  }
}

/** Istanza predefinita per uso con createTerritoryApi / createFetcher. */
export const authFetch = createAuthFetch()
