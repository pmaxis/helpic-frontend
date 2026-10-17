import { http } from '@/services/api'
import type { User, UserResponse } from '@/types/auth'

/** Emails a reset link if the email has an account; answers the same either way. */
export async function forgotPassword(email: string): Promise<void> {
  await http.post('/auth/password/forgot', { email })
}

/** Sets a new password with a reset link; every device is signed out. */
export async function resetPassword(input: { token: string; password: string; password_confirmation: string }): Promise<void> {
  await http.post('/auth/password/reset', input)
}

/** Makes a confirmed email the sign-in email; works signed in or not. */
export async function confirmEmail(token: string): Promise<User> {
  const { data } = await http.post<UserResponse>('/email-changes/confirm', { token })
  return data.user
}
