import { describe, expect, it } from 'vitest'
import { parsePolicy } from '@/utils/policyText'

describe('parsePolicy', () => {
  it('reads headings, paragraphs and lists, a paragraph’s lines run together', () => {
    const body = 'Intro line one\nline two\n\n## What we keep\n- Email\n- Name and\n  surname\nAfter the list\n\n\n## <b>Not HTML</b>\n\nLast'
    expect(parsePolicy(body)).toEqual([
      { kind: 'paragraph', text: 'Intro line one line two' },
      { kind: 'heading', text: 'What we keep' },
      { kind: 'list', items: ['Email', 'Name and surname After the list'] },
      { kind: 'heading', text: '<b>Not HTML</b>' },
      { kind: 'paragraph', text: 'Last' },
    ])
  })

  it('ends a paragraph where a list starts', () => {
    expect(parsePolicy('Lead\n- one\r\n- two')).toEqual([
      { kind: 'paragraph', text: 'Lead' },
      { kind: 'list', items: ['one', 'two'] },
    ])
    expect(parsePolicy('  \n')).toEqual([])
  })
})
