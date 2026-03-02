/**
 * Error boundary: catches render errors and shows fallback (i18n-aware).
 */
import type { ReactNode } from 'react'
import { Component } from 'react'
import { i18n } from '@/shared/i18n'
import { I18N_KEYS } from '@/features/territory'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback
    }
    if (this.state.hasError) {
      return (
        <div role="alert">
          {i18n.t(I18N_KEYS.errorGeneric)}
        </div>
      )
    }
    return this.props.children
  }
}
