/**
 * Auth store: user state only (FGP + cookies handled by authFetch).
 * No JWT: session via cookie and FGP header.
 */
import { create } from 'zustand'

export interface AuthUser {
  nome?: string
  cognome?: string
  email?: string
  preferred_username?: string
  authorities?: { authority: string }[]
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),
  setIsLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}))
