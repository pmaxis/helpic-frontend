import type { RouteLocationNormalizedLoaded } from 'vue-router'

/**
 * The secret of a one-time invite link. The fragment first: browsers send it
 * to no server, so it stays out of proxy logs, history of the path and
 * Referer. The path param is for links emailed before that.
 */
export function linkToken(route: RouteLocationNormalizedLoaded): string {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash) return hash
  return String(route.params.token ?? '')
}
