/**
 * Query provider: placeholder for React Query / TanStack Query.
 * Renders children as-is until a data-fetching library is added.
 */
import type { ReactNode } from 'react'

export function QueryProvider({ children }: { readonly children: ReactNode }) {
  return <>{children}</>
}
