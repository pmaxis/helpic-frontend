/**
 * The building blocks of the forms' Zod schemas. Limits and messages match the
 * backend's, so a form catches what the API would refuse before sending it.
 * A field is required when its schema refuses an empty value; that also puts
 * the asterisk on its label (see useForm). Messages are worked out when a
 * check fails, so they're in whatever language the interface is in by then.
 */
import { z } from 'zod'
import { t } from '@/i18n'

/** The backend's limits. */
export const LIMITS = {
  password: 8,
  /** Bytes, as bcrypt counts them: "ї" takes two. */
  passwordBytes: 72,
  name: 100,
  companyName: 120,
  projectName: 120,
  projectDescription: 5000,
  columnName: 60,
  taskTitle: 200,
  taskDescription: 20000,
  reportTitle: 200,
  reportSummary: 20000,
  /** Days in a report's period, at most. */
  reportDays: 366,
} as const

/** A message, worked out when it's shown. */
export type Message = () => string

/** Fields that must be filled in, and those that may grow too long. A person has a name; a project or a column, a thingName. */
type RequiredField = 'name' | 'thingName' | 'firstName' | 'title'
type LongField = RequiredField | 'lastName' | 'description' | 'summary' | 'companyName'

/** Text that must be filled in, trimmed. */
export function requiredText(field: RequiredField, max: number) {
  return z
    .string()
    .trim()
    .min(1, { error: () => t(`validation.required.${field}`) })
    .max(max, { error: () => t(`validation.tooLong.${field}`) })
}

/** Text that may stay empty, trimmed. */
export function optionalText(field: LongField, max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: () => t(`validation.tooLong.${field}`) })
}

/** An email address, trimmed. */
export function email() {
  return z
    .string()
    .trim()
    .min(1, { error: () => t('validation.emailRequired') })
    .pipe(z.email({ error: () => t('validation.emailInvalid') }))
}

/** A password being signed in with: anything, but something. */
export function currentPassword(message: Message = () => t('validation.passwordRequired')) {
  return z.string().min(1, { error: message })
}

/** A code from an authenticator app, or a recovery code; the API tells which and whether it's right. */
export function twoFactorCode() {
  return z
    .string()
    .trim()
    .min(1, { error: () => t('validation.twoFactorCode') })
}

/** A new password: long enough, short enough, and both a letter and a number. */
export function newPassword() {
  return z
    .string()
    .min(1, { error: () => t('validation.passwordRequired') })
    .min(LIMITS.password, { error: () => t('validation.passwordTooShort', { n: LIMITS.password }) })
    .refine((value) => new TextEncoder().encode(value).length <= LIMITS.passwordBytes, {
      error: () => t('validation.passwordTooLong'),
    })
    .refine((value) => /\p{L}/u.test(value) && /\p{N}/u.test(value), {
      error: () => t('validation.passwordTooSimple'),
    })
}

/** Something picked from a list. */
export function choice(message: Message) {
  return z.string().min(1, { error: message })
}

/** The largest price the backend takes, in whole units. */
const MAX_PRICE = 1_000_000_000

/** A price like "1200", "1 200.50" or "99,90"; empty for no price. */
export function price() {
  return z
    .string()
    .trim()
    .refine(
      (v) => {
        if (!v) return true
        const plain = v.replace(/\s/g, '')
        return /^\d+([.,]\d{1,2})?$/.test(plain) && Number(plain.replace(',', '.')) <= MAX_PRICE
      },
      { error: () => t('validation.price') },
    )
}

/**
 * A check across fields, reported on one of them. It runs even while other
 * fields have errors, so all the problems show at once.
 */
export function across<T extends Record<string, unknown>>(
  field: keyof T & string,
  ok: (values: T) => boolean,
  message: Message,
): [(values: T) => boolean, { path: string[]; error: Message; when: (payload: { value: unknown }) => boolean }] {
  return [
    ok,
    {
      path: [field],
      error: message,
      // Run once the object itself is readable, whatever its fields say.
      when: (payload) => typeof payload.value === 'object' && payload.value !== null,
    },
  ]
}

/** Passwords that must match: the confirmation is reported. */
export function passwordsMatch() {
  return across<{ password: unknown; password_confirmation: unknown }>(
    'password_confirmation',
    (v) => v.password === v.password_confirmation,
    () => t('validation.passwordsDontMatch'),
  )
}

/** Days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}
