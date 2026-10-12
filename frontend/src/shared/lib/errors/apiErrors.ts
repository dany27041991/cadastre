/**
 * Centralized API error handling: normalize responses and exceptions.
 * Uses i18n for user-facing messages when available.
 */
import { i18n } from '@/shared/i18n'
import type { ApiError } from '@/shared/types'

const ERROR_KEYS = {
  generic: 'errors.generic',
  httpError: 'errors.httpError',
} as const

function getTranslatedMessage(
  key: string,
  interpolation?: Record<string, number | string>,
  fallback?: string
): string {
  try {
    if (typeof i18n?.t === 'function') return i18n.t(key, interpolation ?? {})
  } catch {
    // i18n not ready (e.g. tests)
  }
  return fallback ?? key
}

/** Build a consistent ApiError from a failed Response (sync, no body read). */
export function normalizeApiError(response: Response): ApiError {
  const code = response.status.toString()
  const message = getTranslatedMessage(
    ERROR_KEYS.httpError,
    { status: response.status },
    `Request failed (HTTP ${response.status}).`
  )
  return { message, code }
}

/** Build ApiError from an unknown exception (e.g. in catch blocks). */
export function createApiErrorFromException(err: unknown): ApiError {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return { message: (err as Error).message, code: undefined }
  }
  return {
    message: getTranslatedMessage(ERROR_KEYS.generic, undefined, 'Something went wrong.'),
    code: undefined,
  }
}

/** Optional: report error for logging or UI (toast). Override in app if needed. */
export function reportError(err: ApiError | Error): void {
  if (typeof console !== 'undefined' && console.error) {
    console.error(err)
  }
}
