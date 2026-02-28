/**
 * Theme provider: placeholder for theme context (e.g. light/dark).
 * Renders children as-is until theme is implemented.
 */
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  return <>{children}</>
}
