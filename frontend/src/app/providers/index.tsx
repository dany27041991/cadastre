/**
 * App-level providers: compose StrictMode, theme, query, error boundary.
 */
import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'
import { ErrorBoundary } from './error-boundary'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}
