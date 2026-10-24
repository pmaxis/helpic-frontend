import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { daysBetween, email, LIMITS, newPassword, passwordsMatch, price, requiredText } from '@/utils/validation'

/** The first message the schema gives for a value, or '' when it passes. */
function messageFor(schema: z.ZodType, value: unknown): string {
  const result = schema.safeParse(value)
  return result.success ? '' : result.error.issues[0].message
}

describe('requiredText', () => {
  const title = requiredText('title', 5)

  it('trims, and refuses what is empty after trimming', () => {
    expect(title.parse('  Hi  ')).toBe('Hi')
    expect(messageFor(title, '   ')).not.toBe('')
  })

  it('refuses what is too long', () => {
    expect(messageFor(title, '123456')).not.toBe('')
  })
})

describe('email', () => {
  it('trims a good address and refuses a bad one', () => {
    expect(email().parse(' olena@example.test ')).toBe('olena@example.test')
    expect(messageFor(email(), 'olena@')).not.toBe('')
    expect(messageFor(email(), '')).not.toBe('')
  })
})

describe('newPassword', () => {
  it('needs the minimum length, a letter and a number', () => {
    expect(messageFor(newPassword(), 'short1')).toContain(String(LIMITS.password))
    expect(messageFor(newPassword(), 'onlyletters')).not.toBe('')
    expect(messageFor(newPassword(), '1234567890')).not.toBe('')
    expect(messageFor(newPassword(), 'пароль2030')).toBe('')
  })

  it('counts bytes as bcrypt does: a Cyrillic letter takes two', () => {
    const cyrillic = 'ї'.repeat(36) + '1'
    expect(cyrillic.length).toBeLessThan(LIMITS.passwordBytes)
    expect(messageFor(newPassword(), cyrillic)).not.toBe('')
  })
})

describe('passwordsMatch', () => {
  const schema = z.object({ password: z.string(), password_confirmation: z.string() }).refine(...passwordsMatch())

  it('reports a mismatch on the confirmation', () => {
    const result = schema.safeParse({ password: 'abc12345', password_confirmation: 'abc12346' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['password_confirmation'])
  })
})

describe('price', () => {
  it('takes whole amounts, cents with a dot or comma, spaces, and nothing', () => {
    for (const ok of ['', '1200', '1 200.50', '99,90']) expect(messageFor(price(), ok)).toBe('')
  })

  it('refuses three decimals, words and more than the backend takes', () => {
    for (const bad of ['1.999', 'ten', '1000000001']) expect(messageFor(price(), bad)).not.toBe('')
  })
})

describe('daysBetween', () => {
  it('counts the days from one date to another', () => {
    expect(daysBetween('2030-01-01', '2030-01-31')).toBe(30)
    expect(daysBetween('2030-01-01', '2030-01-01')).toBe(0)
  })
})
