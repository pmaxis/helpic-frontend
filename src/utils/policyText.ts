/**
 * A policy's text in blocks to lay out: "## " starts a heading, "- " a list
 * item, an empty line ends a paragraph, and a paragraph's lines run together.
 * It is laid out as text, never as HTML, so whatever an admin writes stays
 * words on the page.
 */
export type PolicyBlock = { kind: 'heading'; text: string } | { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] }

export function parsePolicy(body: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
    if (list) blocks.push({ kind: 'list', items: list })
    paragraph = []
    list = null
  }

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flush()
    } else if (line.startsWith('## ')) {
      flush()
      blocks.push({ kind: 'heading', text: line.slice(3).trim() })
    } else if (line.startsWith('- ')) {
      if (paragraph.length) flush()
      list ??= []
      list.push(line.slice(2).trim())
    } else if (list) {
      // a list item's text going on onto the next line
      list[list.length - 1] += ` ${line}`
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

/** The anchor of a policy's n-th heading, from 1, for its table of contents. */
export function sectionId(n: number): string {
  return `section-${n}`
}
