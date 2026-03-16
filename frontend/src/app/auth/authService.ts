/**
 * Servizio autenticazione: imposta l'utente nello store (da Single-SPA props o da API).
 * Nessun JWT: sessione tramite FGP + cookies.
 */
import type { AppProps } from 'single-spa'
import type { AuthUser } from '@/app/store'
import { useAuthStore } from '@/app/store'

export const authService = {
  /**
   * Imposta l'utente dallo shell Single-SPA (customProps.user) se presente.
   * Da chiamare in mount(props).
   */
  setUserFromProps(props: AppProps): void {
    const user = (props?.customProps as { user?: AuthUser })?.user
    if (user) {
      useAuthStore.getState().setUser(user)
    }
  },

  /** Pulisce lo stato utente (logout lato microfrontend). */
  logout(): void {
    useAuthStore.getState().logout()
  },
}
