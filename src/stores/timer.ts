import { defineStore } from 'pinia'
import { fetchTimer, startTimer, stopTimer } from '@/services/time'
import type { TimeEntry } from '@/types/time'

interface TimerState {
  /** The user's running timer, or null. */
  running: TimeEntry | null
  /** Now, in ms, moved every second while a timer runs, so its clock ticks. */
  now: number
  loaded: boolean
  /**
   * Counts the timer's starts and stops, with the tasks they touched, so a
   * page showing one of those tasks reloads its time and price.
   */
  version: number
  touched: string[]
}

let tick: number | undefined

/** The user's one running timer, shown in the sidebar and on its task. */
export const useTimerStore = defineStore('timer', {
  state: (): TimerState => ({ running: null, now: Date.now(), loaded: false, version: 0, touched: [] }),

  getters: {
    /** Seconds on the running entry so far, the time since it started included. */
    elapsed(state): number {
      const r = state.running
      if (!r?.running_since) return 0
      return r.seconds + Math.max(0, Math.floor((state.now - new Date(r.running_since).getTime()) / 1000))
    },
  },

  actions: {
    async load(): Promise<void> {
      try {
        this.set(await fetchTimer())
        this.loaded = true
      } catch {
        // Without it the sidebar just shows no timer.
      }
    },

    async start(taskId: string): Promise<void> {
      const before = this.running?.task_id
      this.set(await startTimer(taskId))
      this.changed(before, taskId)
    },

    async stop(): Promise<void> {
      const entry = await stopTimer()
      this.set(null)
      this.changed(entry.task_id)
    },

    set(entry: TimeEntry | null): void {
      this.running = entry
      this.now = Date.now()
      window.clearInterval(tick)
      tick = entry ? window.setInterval(() => (this.now = Date.now()), 1000) : undefined
    },

    changed(...taskIds: (string | undefined)[]): void {
      this.touched = taskIds.filter((id): id is string => !!id)
      this.version++
    },

    reset(): void {
      this.set(null)
      this.loaded = false
    },
  },
})
