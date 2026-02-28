/**
 * Sync state with URL (query params). For deep-linking and persistence on refresh.
 * TODO: implement when table/filters need URL sync (e.g. pagination, sort, filters).
 */
import { useState } from 'react'

export function useUrlState<T>(_key: string, defaultValue: T): [T, (value: T) => void] {
  // Stub: local state only until URL sync is implemented
  const [value, setValue] = useState<T>(defaultValue)
  return [value, setValue]
}
