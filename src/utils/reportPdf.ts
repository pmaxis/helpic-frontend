import regular from '@/assets/fonts/Inter-Regular.ttf?url'
import medium from '@/assets/fonts/Inter-Medium.ttf?url'
import semiBold from '@/assets/fonts/Inter-SemiBold.ttf?url'
import bold from '@/assets/fonts/Inter-Bold.ttf?url'
import type { Report } from '@/types/reports'
import { logoDataURL } from '@/services/branding'
import { buildSheet, type SheetOptions } from './reportSheet'
import { reportDocument } from './reportDocument'

type PdfMake = typeof import('pdfmake')

/** pdfmake fetches fonts by URL, so the bundled files are given as absolute ones. */
function family(normal: string, heavy = normal) {
  const url = (path: string) => new URL(path, location.href).href
  return { normal: url(normal), bold: url(heavy), italics: url(normal), bolditalics: url(heavy) }
}

let loading: Promise<PdfMake> | null = null

/** pdfmake with Inter, loaded on first use. */
function pdfMake(): Promise<PdfMake> {
  loading ??= import('pdfmake').then((mod) => {
    const pdf = (mod as { default?: PdfMake }).default ?? mod
    pdf.setUrlAccessPolicy((url) => url.startsWith(location.origin))
    pdf.addFonts({ Inter: family(regular, bold), InterMedium: family(medium), InterSemiBold: family(semiBold) })
    return pdf
  })
  return loading
}

/** Logos as data URLs by their ID: a logo never changes, so each is fetched once. */
const logos = new Map<string, Promise<string>>()

/** The report's logo as a data URL; '' without one, or when it can't be had (the report prints without it). */
async function reportLogo(report: Report): Promise<string> {
  const id = report.branding.logo_id
  if (!id) return ''
  let logo = logos.get(id)
  if (!logo) {
    logo = logoDataURL(id, report.id)
    logos.set(id, logo)
    logo.catch(() => logos.delete(id))
  }
  return logo.catch(() => '')
}

/** The report as a PDF file, with its logo. */
export async function renderReportPdf(report: Report, options: Omit<SheetOptions, 'logo'> = {}): Promise<ArrayBuffer> {
  const [pdf, logo] = await Promise.all([pdfMake(), reportLogo(report)])
  const blob = await pdf.createPdf(reportDocument(buildSheet(report, { ...options, logo }))).getBlob()
  return blob.arrayBuffer()
}

/** "Work report.pdf", with characters a file name cannot hold turned into spaces. */
export function pdfFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${base || 'Work report'}.pdf`
}

export function savePdf(data: ArrayBuffer, filename: string): void {
  const href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
