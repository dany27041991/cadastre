/** Etichetta leggibile per chiavi colonna DB. */
export function labelizeGreenColumn(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
