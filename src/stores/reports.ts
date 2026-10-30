import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { Report, ReportComment, ReportEvent, ReportInput, ReportKind, ReportReview } from '@/types/reports'

interface ReportsState {
  reports: Report[]
  loaded: boolean
}

/** Reports of work done: a freelancer's drafts and sent reports, a client's received ones. */
export const useReportsStore = defineStore('reports', {
  state: (): ReportsState => ({ reports: [], loaded: false }),

  actions: {
    async fetchReports(): Promise<void> {
      const { data } = await http.get<{ reports: Report[] }>('/reports')
      this.reports = data.reports ?? []
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

    /** What the two sides said about the report and its lines, oldest first. */
    async fetchComments(id: string): Promise<ReportComment[]> {
      const { data } = await http.get<{ comments: ReportComment[] }>(`/reports/${id}/comments`)
      return data.comments ?? []
    },

    /** On a line, or the report as a whole (no itemId); the client's comment on a line asks a question about it. */
    async addComment(id: string, body: string, itemId?: string): Promise<ReportComment> {
      const { data } = await http.post<{ comment: ReportComment }>(`/reports/${id}/comments`, { item_id: itemId ?? '', body })
      return data.comment
    },

    /** Closes the question on a line. */
    async resolveQuestion(id: string, itemId: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/items/${itemId}/resolve`)
      return data.report
    },

    /** The client approves a sent report, or asks for changes saying what (added to its discussion). */
    async reviewReport(id: string, review: ReportReview, comment = ''): Promise<Report> {
      const { data } = await http.put<{ report: Report }>(`/reports/${id}/review`, { review, comment })
      this.loaded = false
      return data.report
    },

    /** The freelancer keeps the report as it is instead of the changes asked for, saying why. */
    async keepReport(id: string, comment: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/keep`, { comment })
      this.loaded = false
      return data.report
    },

    /** The freelancer takes a sent report back to correct it: a draft again, out of the client's sight. */
    async recallReport(id: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/recall`)
      this.loaded = false
      return data.report
    },

    async sendReport(id: string): Promise<Report> {
      const { data } = await http.post<{ report: Report }>(`/reports/${id}/send`)
      this.loaded = false
      return data.report
    },

    async deleteReport(id: string): Promise<void> {
      await http.delete(`/reports/${id}`)
      this.reports = this.reports.filter((r) => r.id !== id)
    },
  },
})
