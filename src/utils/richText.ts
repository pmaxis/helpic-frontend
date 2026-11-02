/**
 * A task's description: Markdown, written in a WYSIWYG editor. Descriptions
 * written as plain text before read the same way — a line break stays a line
 * break, and "- " and "1. " lines were lists already.
 */
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
// What the editor can't write: no tables, and no images that would load from elsewhere.
md.disable(['table', 'image'])

// Links open in a new tab and don't tell the other site where they came from.
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow')
  return self.renderToken(tokens, idx, options)
}

/** The description as HTML: HTML of its own turned off, so the text can't put markup on the page. */
export function renderRichText(source: string): string {
  return md.render(source)
}

/** An inline run's words, without the marks: bold, links, code… */
function inlineText(token: Token, breakAs = '\n'): string {
  return (token.children ?? [])
    .map((c) => {
      if (c.type === 'text' || c.type === 'code_inline') return c.content
      if (c.type === 'softbreak' || c.type === 'hardbreak') return breakAs
      return ''
    })
    .join('')
}

/** The first line of words in it, as a hint in a list; '' when there are none. */
export function firstLine(source: string): string {
  for (const token of md.parse(source, {})) {
    const text =
      token.type === 'inline'
        ? inlineText(token)
        : token.type === 'fence' || token.type === 'code_block'
          ? token.content
          : ''
    const line = text
      .split('\n')
      .map((l) => l.replace(/ /g, ' ').trim())
      .find(Boolean)
    if (line) return line
  }
  return ''
}

/**
 * The text without its marks, laid out as plain text: paragraphs parted by a
 * blank line, list items as "- " or "1. " lines, a line break kept.
 */
export function toPlainText(source: string): string {
  const out: string[] = []
  const lists: { ordered: boolean; n: number }[] = []
  let line = ''
  const flush = () => {
    const l = line.replace(/ /g, ' ').trimEnd()
    if (l.trim()) out.push(l)
    line = ''
  }
  const gap = () => {
    if (!lists.length && out.length && out.at(-1) !== '') out.push('')
  }
  for (const token of md.parse(source, {})) {
    switch (token.type) {
      case 'bullet_list_open':
      case 'ordered_list_open':
        gap()
        lists.push({ ordered: token.type === 'ordered_list_open', n: Number(token.attrGet('start') ?? 1) })
        break
      case 'bullet_list_close':
      case 'ordered_list_close':
        lists.pop()
        gap()
        break
      case 'list_item_open': {
        const list = lists.at(-1)!
        line = '  '.repeat(lists.length - 1) + (list.ordered ? `${list.n++}. ` : '- ')
        break
      }
      case 'inline':
        line += inlineText(token)
        break
      case 'fence':
      case 'code_block':
        line += token.content.replace(/\n$/, '')
        flush()
        gap()
        break
      case 'paragraph_close':
      case 'heading_close':
        flush()
        gap()
        break
    }
  }
  flush()
  while (out.at(-1) === '') out.pop()
  return out.join('\n')
}
