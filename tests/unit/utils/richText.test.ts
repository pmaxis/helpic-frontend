import { describe, expect, it } from 'vitest'
import { firstLine, renderRichText, toPlainText } from '@/utils/richText'

describe('renderRichText', () => {
  it('formats Markdown and keeps a plain line break', () => {
    const html = renderRichText('## Goal\n\n**Bold** and _it_\nnext line\n\n- one\n- two')
    expect(html).toContain('<h2>Goal</h2>')
    expect(html).toContain('<strong>Bold</strong> and <em>it</em><br>\nnext line')
    expect(html).toContain('<ul>\n<li>one</li>')
  })

  it("doesn't let the text put markup or images on the page", () => {
    const html = renderRichText('<img src=x onerror=alert(1)> ![a](http://x/y.png) [x](javascript:alert(1))')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript')
    expect(html).toContain('&lt;img')
  })

  it('opens links in a new tab', () => {
    expect(renderRichText('[site](https://example.com)')).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a>',
    )
  })
})

describe('firstLine', () => {
  it('is the first line of words, without the marks', () => {
    expect(firstLine('\n\n## **Fix** the `login`\n\nmore')).toBe('Fix the login')
    expect(firstLine('- [item](https://x.io)\n- two')).toBe('item')
    expect(firstLine('plain\nsecond')).toBe('plain')
    expect(firstLine('&nbsp;\n\nreal')).toBe('real')
    expect(firstLine('')).toBe('')
  })
})

describe('toPlainText', () => {
  it('drops the marks and keeps paragraphs and lists', () => {
    expect(toPlainText('## Done\n\nFixed **the** [form](https://x.io).\n\n1. one\n2. two\n\n- a\n  - b')).toBe(
      'Done\n\nFixed the form.\n\n1. one\n2. two\n\n- a\n  - b',
    )
  })

  it('leaves plain text as it was', () => {
    expect(toPlainText('First\nsecond line\n\nThird')).toBe('First\nsecond line\n\nThird')
  })

  it('keeps code as written', () => {
    expect(toPlainText('```\nconst a = 1\n```')).toBe('const a = 1')
  })
})
