import type { TeamRole } from '@/types/team'

/**
 * Public sign-up creates a freelancer; clients join by a freelancer's
 * invitation. An admin runs the platform, with no work of their own, and is
 * made only with the backend's cli.
 */
export type Role = 'freelancer' | 'client' | 'admin'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  /** Full name, "first last". */
  name: string
  role: Role
  /** What a freelancer bills in: their task prices and reports use it. */
  currency: string
  /** A freelancer's rate for an hour, in cents of their currency; null when unset. */
  hourly_rate_cents: number | null
  /** The language they read Helpic in; their emails and Telegram messages too. */
  locale: 'en' | 'uk'
  /** Set for a member of a client's company: they act for it, but don't see its reports. */
  member_of: { owner_id: string; name: string; role: TeamRole } | null
  /** Signing in also takes a code from an authenticator app. */
  two_factor: boolean
  created_at: string
}

export interface UserResponse {
  user: User
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
  password_confirmation: string
  /** Who signs up; a freelancer when left out. */
  role?: Exclude<Role, 'admin'>
}

export interface ChangeEmailPayload {
  email: string
  current_password: string
}

export interface ChangePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

export interface LoginPayload {
  email: string
  password: string
  /** Asked for once the password is right, when the account has two-factor on: six digits from the app, or a recovery code. */
  code?: string
}

/** The API's answer to a right password when the account also needs a code. */
export const TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED'

/** Where the account's two-factor sign-in stands. */
export interface TwoFactorStatus {
  enabled: boolean
  /** Unused recovery codes; 0 while off. */
  recovery_codes_left: number
}

/** What goes into the authenticator app while turning two-factor on. */
export interface TwoFactorSetup {
  /** For typing in by hand. */
  secret: string
  /** The otpauth:// link the QR code carries. */
  uri: string
  /** The QR code, an image data: URL. */
  qr: string
}

/** Unified API error envelope returned by the backend. */
export interface ApiError {
  code: string
  message: string
  fields?: Record<string, string>
}

/** A signed-in device. */
export interface Session {
  id: string
  user_agent: string
  ip: string
  /** The device looking at the list. */
  current: boolean
  created_at: string
  last_used_at: string
  expires_at: string
}
