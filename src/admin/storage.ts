/** How much of a limit is used, 0…1 (more when over); 0 when there's no limit. */
export function share(used: number, limit: number): number {
  return limit > 0 ? used / limit : 0
}

/** Share at which an account counts as near its quota, as the server counts it. */
export const NEAR_QUOTA = 0.9

/** The colour of a bar filled to share: red when full, amber when near, ink below. */
export function meterClass(s: number): string {
  if (s >= 1) return 'bg-red-500'
  if (s >= NEAR_QUOTA) return 'bg-amber-500'
  return 'bg-neutral-900'
}

/** The bar's width, never past full and never so thin it vanishes. */
export function meterWidth(s: number): string {
  return `${s > 0 ? Math.min(100, Math.max(2, s * 100)) : 0}%`
}
