/**
 * A comment's text: Markdown, with mentions written as @[Name](user ID). The
 * box to write in shows a mention as @Name; the text is turned back and
 * forth on the way in and out, against the people the task's comments can
 * mention.
 */
import MarkdownIt from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import type { CommentPerson } from '@/types/comments'

const MENTION = /@\[([^[\]\n]{1,200})\]\(([0-9a-fA-F-]{36})\)/g
/** The same, at the start of the text. */
const MENTION_HERE = /^@\[([^[\]\n]{1,200})\]\(([0-9a-fA-F-]{36})\)/
/** What follows a name that ends it: not a letter, digit or underscore. */
const NAME_END = '(?![\\p{L}\\p{N}_])'

/**
 * How the box to write in calls each person: their name, or their email when
 * they have none or share the name with someone else.
 */
export function mentionLabels(people: CommentPerson[]): Map<string, CommentPerson> {
  const name = (p: CommentPerson) => p.name.trim().replace(/\s+/g, ' ').replace(/[[\]]/g, '')
  const count = new Map<string, number>()
  for (const p of people) count.set(name(p), (count.get(name(p)) ?? 0) + 1)
  const out = new Map<string, CommentPerson>()
  for (const p of people) {
    const label = name(p) && count.get(name(p)) === 1 ? name(p) : p.email
    out.set(label, p)
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The text for the box: each mention as @Name. */
export function toEditable(body: string, people: CommentPerson[]): string {
  const labels = [...mentionLabels(people)]
  return body.replace(MENTION, (_, name: string, id: string) => {
    const known = labels.find(([, p]) => p.id === id.toLowerCase())
    return '@' + (known ? known[0] : name)
  })
}

/** The text to send: each @Name of someone who can be mentioned as their mention. */
export function toBody(text: string, people: CommentPerson[]): string {
  const labels = mentionLabels(people)
  if (!labels.size) return text
  const names = [...labels.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp)
  const at = new RegExp(`(?<![\\p{L}\\p{N}_])@(${names.join('|')})${NAME_END}`, 'gu')
  return text.replace(at, (_, label: string) => `@[${label}](${labels.get(label)!.id})`)
}

/** The person being mentioned at the caret: the @ and what follows it, up to the caret. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[\s(])@([^\s@]{0,40})$/u.exec(text.slice(0, caret))
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null
}

/** Whether the person answers to what was typed after @: a word of their name, or their email. */
export function matchesMention(label: string, p: CommentPerson, query: string): boolean {
  const q = query.toLocaleLowerCase()
  if (!q) return true
  return label.toLocaleLowerCase().split(' ').some((w) => w.startsWith(q)) || p.email.toLocaleLowerCase().startsWith(q)
}

// --- showing -----------------------------------------------------------------------

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
// A comment is a message: no headings out of a line starting with #, no
// tables, and no images that would load from elsewhere.
md.disable(['heading', 'lheading', 'table', 'image'])

md.inline.ruler.before('link', 'mention', (state: StateInline, silent: boolean) => {
  if (state.src.charCodeAt(state.pos) !== 0x40 /* @ */) return false
  const m = MENTION_HERE.exec(state.src.slice(state.pos))
  if (!m) return false
  if (!silent) state.push('mention', '', 0).meta = { name: m[1], id: m[2].toLowerCase() }
  state.pos += m[0].length
  return true
})

md.renderer.rules.mention = (tokens, idx, _options, env: { viewerId?: string }) => {
  const { name, id } = tokens[idx].meta as { name: string; id: string }
  const cls = id === env.viewerId ? 'mention mention-you' : 'mention'
  return `<span class="${cls}">@${md.utils.escapeHtml(name)}</span>`
}

// Links open in a new tab and don't tell the other site where they came from.
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow')
  return self.renderToken(tokens, idx, options)
}

/**
 * The comment as HTML: Markdown with HTML of its own turned off, so the text
 * can't put markup on the page. A mention of the viewer stands out.
 */
export function renderComment(body: string, viewerId?: string): string {
  return md.render(body, { viewerId })
}
