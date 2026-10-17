/**
 * The building blocks of the forms' Zod schemas. Limits and messages match the
 * backend's, so a form catches what the API would refuse before sending it.
 * A field is required when its schema refuses an empty value; that also puts
 * the asterisk on its label (see useForm).
 */
import { z } from 'zod'

/** The backend's limits. */
export const LIMITS = {
  password: 8,
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

/** Text that must be filled in, trimmed. */
export function requiredText(label: string, max: number) {
  return z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`)
}

/** Text that may stay empty, trimmed. */
export function optionalText(label: string, max: number) {
  return z.string().trim().max(max, `${label} is too long`)
}

/** An email address, trimmed. */
export function email() {
  return z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address'))
}

/** A password being signed in with: anything, but something. */
export function currentPassword(message = 'Password is required') {
  return z.string().min(1, message)
}

/** A new password: long enough. */
export function newPassword() {
  return z
    .string()
    .min(1, 'Password is required')
    .min(LIMITS.password, `Password must be at least ${LIMITS.password} characters`)
}

/** Something picked from a list. */
export function choice(message: string) {
  return z.string().min(1, message)
}

/** The largest price the backend takes, in whole units. */
const MAX_PRICE = 1_000_000_000

/** A price like "1200", "1 200.50" or "99,90"; empty for no price. */
export function price() {
  return z
    .string()
    .trim()
    .refine((v) => {
      if (!v) return true
      const plain = v.replace(/\s/g, '')
      return /^\d+([.,]\d{1,2})?$/.test(plain) && Number(plain.replace(',', '.')) <= MAX_PRICE
    }, 'Enter an amount like 1200 or 99.50')
}

/**
 * A check across fields, reported on one of them. It runs even while other
 * fields have errors, so all the problems show at once.
 */
export function across<T extends Record<string, unknown>>(
  field: keyof T & string,
  ok: (values: T) => boolean,
  message: string,
): [(values: T) => boolean, { path: string[]; message: string; when: (payload: { value: unknown }) => boolean }] {
  return [
    ok,
    {
      path: [field],
      message,
      // Run once the object itself is readable, whatever its fields say.
      when: (payload) => typeof payload.value === 'object' && payload.value !== null,
    },
  ]
}

/** Days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}
