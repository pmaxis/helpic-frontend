import type { RouteLocationNormalizedLoaded } from 'vue-router'

/**
 * The secret of a one-time link: the path segment, as in /invite/<token>.
 * A fragment is a link emailed before that.
 */
export function linkToken(route: RouteLocationNormalizedLoaded): string {
  const fromPath = String(route.params.token ?? '')
  if (fromPath) return fromPath
  return window.location.hash.replace(/^#/, '')
}
