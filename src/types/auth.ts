/** Public sign-up creates a freelancer; clients join by a freelancer's invitation. */
export type Role = 'freelancer' | 'client'

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
  /** The language they read Helpic in; their emails and Telegram messages too. */
  locale: 'en' | 'uk'
  /** Set for a member of a client's company: they act for it, but don't see its reports. */
  member_of: { owner_id: string; name: string } | null
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
