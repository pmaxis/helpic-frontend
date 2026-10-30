import { http } from '@/services/api'
import type { Branding } from '@/types/reports'

/** The largest logo the server takes, and the images it takes. */
export const MAX_LOGO_BYTES = 512 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg']

/** How the freelancer's reports look. */
export async function fetchBranding(): Promise<Branding> {
  const { data } = await http.get<{ branding: Branding }>('/me/branding')
  return data.branding
}

/** The accent color (null for none) and business details; drafts show them at once. */
export async function saveBranding(input: { color: string | null; details: string }): Promise<Branding> {
  const { data } = await http.put<{ branding: Branding }>('/me/branding', input)
  return data.branding
}

/** A PNG or JPEG in place of the logo there was. */
export async function uploadLogo(file: File): Promise<Branding> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.put<{ branding: Branding }>('/me/branding/logo', form, {
    // Let the browser set the multipart boundary (the app default is JSON).
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.branding
}

/** Takes the logo off; reports already sent keep theirs. */
export async function removeLogo(): Promise<Branding> {
  const { data } = await http.delete<{ branding: Branding }>('/me/branding/logo')
  return data.branding
}

/**
 * A logo as a data URL, which a PDF takes in place of an address: the
 * freelancer's own (no report), or a report's. The logo's ID keeps the
 * browser from showing an old one from its cache.
 */
export async function logoDataURL(logoId: string, reportId?: string): Promise<string> {
  const url = reportId ? `/reports/${reportId}/logo` : '/me/branding/logo'
  const { data } = await http.get<Blob>(url, { params: { v: logoId }, responseType: 'blob' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(data)
  })
}
