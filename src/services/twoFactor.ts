import { http } from '@/services/api'
import type { TwoFactorSetup, TwoFactorStatus, User, UserResponse } from '@/types/auth'

/** Whether two-factor is on, and how many recovery codes are left. */
export async function fetchTwoFactor(): Promise<TwoFactorStatus> {
  const { data } = await http.get<TwoFactorStatus>('/me/two-factor')
  return data
}

/** Checks the password and makes a new secret for the app; signing in doesn't change until it's confirmed. */
export async function beginTwoFactor(currentPassword: string): Promise<TwoFactorSetup> {
  const { data } = await http.post<TwoFactorSetup>('/me/two-factor/setup', { current_password: currentPassword })
  return data
}

/** Turns two-factor on with a code from the app; other devices are signed out. The recovery codes are shown this once. */
export async function enableTwoFactor(code: string): Promise<{ user: User; recovery_codes: string[] }> {
  const { data } = await http.post<{ user: User; recovery_codes: string[] }>('/me/two-factor/enable', { code })
  return data
}

/** Turns two-factor off; takes the password and a code from the app or a recovery code. */
export async function disableTwoFactor(input: { current_password: string; code: string }): Promise<User> {
  const { data } = await http.post<UserResponse>('/me/two-factor/disable', input)
  return data.user
}

/** Replaces the recovery codes; the old ones stop working. Takes the password and a code. */
export async function renewRecoveryCodes(input: { current_password: string; code: string }): Promise<string[]> {
  const { data } = await http.post<{ recovery_codes: string[] }>('/me/two-factor/recovery-codes', input)
  return data.recovery_codes
}
