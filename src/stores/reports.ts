import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { Report, ReportEvent, ReportInput, ReportKind } from '@/types/reports'

interface ReportsState {
  reports: Report[]
  loaded: boolean
  /** Whether the server can print PDFs (it needs Chromium). */
  pdfAvailable: boolean
}

async function fetchPdf(url: string): Promise<ArrayBuffer> {
  const { data } = await http.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 60000 })
  return data
}

/** Saves a server-rendered PDF under the file name the server suggests. */
async function downloadPdf(url: string, fallbackName: string): Promise<void> {
  const resp = await http.get<Blob>(url, { responseType: 'blob', timeout: 60000 })
  const disposition = String(resp.headers['content-disposition'] ?? '')
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const plain = /filename="([^"]+)"/i.exec(disposition)?.[1]
  const name = utf8 ? decodeURIComponent(utf8) : plain || fallbackName
  const href = URL.createObjectURL(resp.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** Reports of work done: a freelancer's drafts and sent reports, a client's received ones. */
export const useReportsStore = defineStore('reports', {
  state: (): ReportsState => ({ reports: [], loaded: false, pdfAvailable: true }),

  actions: {
    async fetchReports(): Promise<void> {
      const { data } = await http.get<{ reports: Report[]; pdf_available: boolean }>('/reports')
      this.reports = data.reports ?? []
      this.pdfAvailable = data.pdf_available
      this.loaded = true
    },

    async fetchReport(id: string): Promise<Report> {
      const { data } = await http.get<{ report: Report }>(`/reports/${id}`)
      return data.report
    },

    async createReport(input: ReportInput): Promise<Report> {
      const { data } = await http.post<{ report: Report }>('/reports', input)
      this.loaded = false
      return data.report
    },

    /** Edits a draft; without `kind` the report keeps its kind. */
    async updateReport(id: string, input: { title: string; summary: string; kind?: ReportKind }): Promise<Report> {
      const { data } = await http.put<{ report: Report }>(`/reports/${id}`, input)
      return data.report
    },

    /** Rewrites what a draft says was done in one task. */
    async updateItemNotes(id: string, itemId: string, notes: string): Promise<Report> {
      const { data } = await http.put<{ report: Report }>(`/reports/${id}/items/${itemId}`, { notes })
      return data.report
    },

    async removeItem(id: string, itemId: string): Promise<Report> {
      const { data } = await http.delete<{ report: Report }>(`/reports/${id}/items/${itemId}`)
      return data.report
    },

    /** The client says they paid it; its tasks move to the Paid column. */
    async markPaid(id: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/paid`)
      this.loaded = false
      return data.report
    },

    async fetchHistory(id: string): Promise<ReportEvent[]> {
      const { data } = await http.get<{ events: ReportEvent[] }>(`/reports/${id}/history`)
      return data.events ?? []
    },

    async sendReport(id: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/send`)
      this.loaded = false
      return data.report
    },

    /** The report as printed, for the on-page preview. */
    fetchPdf(id: string): Promise<ArrayBuffer> {
      return fetchPdf(`/reports/${id}/pdf`)
    },

    downloadPdf(id: string): Promise<void> {
      return downloadPdf(`/reports/${id}/pdf?download=1`, 'Work report.pdf')
    },

    async deleteReport(id: string): Promise<void> {
      await http.delete(`/reports/${id}`)
      this.reports = this.reports.filter((r) => r.id !== id)
    },
  },
})
