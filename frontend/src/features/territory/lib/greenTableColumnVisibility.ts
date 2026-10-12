/**
 * Identifiers (PK / FK) must not appear in the green table UI: columns, checkboxes, filter dropdown.
 * Row payloads still contain these keys for actions/APIs.
 */
export function isGreenTableIdColumn(key: string): boolean {
  if (key === 'id') return true
  return key.endsWith('_id')
}

export function filterGreenTableNonIdKeys(keys: string[]): string[] {
  return keys.filter((k) => !isGreenTableIdColumn(k))
}
