import { http } from '@/services/api'

/** Titles asked for, so a page is asked about once per session. */
const titles = new Map<string, Promise<string | null>>()

/**
 * The title of the page at url, which the server reads; null when the page
 * couldn't be read, has none, or the address isn't a public one.
 */
export function fetchPageTitle(url: string): Promise<string | null> {
  let title = titles.get(url)
  if (!title) {
    title = http
      .post<{ title: string }>('/link-preview', { url }, { timeout: 8000 })
      .then(({ data }) => data.title.trim() || null)
      .catch(() => {
        // Not remembered: the page may answer later.
        titles.delete(url)
        return null
      })
    titles.set(url, title)
  }
  return title
}
