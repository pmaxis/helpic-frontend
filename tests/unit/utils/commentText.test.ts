import { describe, expect, it } from 'vitest'
import { matchesMention, mentionAt, mentionLabels, renderComment, toBody, toEditable } from '@/utils/commentText'

const anna = { id: '0b6e2c1a-7f43-4c2e-9d55-3a1f6c8e2b10', name: 'Anna Kovalenko', email: 'anna@example.com' }
const max = { id: '5d9a4e7b-2c18-4b6f-8e03-9f7c1a2d4e65', name: '', email: 'max@example.com' }
const otherAnna = { id: '9e1b3c5d-7a2f-4e68-b0d4-1c3e5a7b9d2f', name: 'Anna Kovalenko', email: 'anna.k@example.com' }

describe('mentions in the box', () => {
  it('calls people by name, or by email without one or when two share it', () => {
    expect([...mentionLabels([anna, max]).keys()]).toEqual(['Anna Kovalenko', 'max@example.com'])
    expect([...mentionLabels([anna, otherAnna]).keys()]).toEqual(['anna@example.com', 'anna.k@example.com'])
  })

  it('turns @Name into a mention and back', () => {
    const text = 'Hi @Anna Kovalenko and @max@example.com, not @Anna or mail@Anna Kovalenko'
    const body = toBody(text, [anna, max])
    expect(body).toBe(`Hi @[Anna Kovalenko](${anna.id}) and @[max@example.com](${max.id}), not @Anna or mail@Anna Kovalenko`)
    expect(toEditable(body, [anna, max])).toBe(text)
    // Someone no longer on the task stays by the name they had.
    expect(toEditable(body, [])).toBe(text)
    expect(toBody(text, [])).toBe(text)
  })

  it('finds the @ being typed and who it means', () => {
    expect(mentionAt('Hey @an', 7)).toEqual({ start: 4, query: 'an' })
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionAt('mail@an', 7)).toBeNull()
    expect(mentionAt('@anna done', 10)).toBeNull()
    expect(matchesMention('Anna Kovalenko', anna, 'kov')).toBe(true)
    expect(matchesMention('Anna Kovalenko', anna, 'anna@')).toBe(true)
    expect(matchesMention('Anna Kovalenko', anna, 'max')).toBe(false)
  })
})

describe('renderComment', () => {
  it('renders Markdown, links to a new tab, and no markup of its own', () => {
    const html = renderComment('**Bold** _it_ `x`\nnext\n\n- one\n\n<img src=x onerror=alert(1)> [js](javascript:alert(1)) https://example.com')
    expect(html).toContain('<strong>Bold</strong> <em>it</em> <code>x</code><br>')
    expect(html).toContain('<ul>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">')
  })

  it('leaves out headings and images', () => {
    expect(renderComment('# Not a heading')).toBe('<p># Not a heading</p>\n')
    expect(renderComment('![x](https://evil.example/pixel.png)')).not.toContain('<img')
  })

  it('shows mentions, the viewer’s own standing out', () => {
    const body = `@[Anna <b>](${anna.id}) and @[Max](${max.id})`
    const html = renderComment(body, max.id)
    expect(html).toContain('<span class="mention">@Anna &lt;b&gt;</span>')
    expect(html).toContain('<span class="mention mention-you">@Max</span>')
    expect(html).not.toContain('<a ')
  })
})
