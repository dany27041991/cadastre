/**
 * Auth helpers: set user in store (Single-SPA props or API).
 * No JWT: session via FGP + cookies.
 */
import type { AppProps } from 'single-spa'
import type { AuthUser } from '@/app/store'
import { useAuthStore } from '@/app/store'

export const authService = {
  /**
   * Set user from Single-SPA shell customProps.user when present.
   * Call from mount(props).
   */
  setUserFromProps(props: AppProps): void {
    const user = (props?.customProps as { user?: AuthUser })?.user
    if (user) {
      useAuthStore.getState().setUser(user)
    }
  },

  /** Clear user state (microfrontend-side logout). */
  logout(): void {
    useAuthStore.getState().logout()
  },
}
