import { EventEmitter } from 'events'
import { powerMonitor } from 'electron'
import { AppSettings, BreakStatus, BreakType } from '../shared/types'

interface TrackedBreak {
  breakType: BreakType
  nextTriggerAt: number
}

const TICK_MS = 1000

export class TimerManager extends EventEmitter {
  private breaks: Map<string, TrackedBreak> = new Map()
  private paused = false
  private pausedAt = 0
  private intervalHandle: NodeJS.Timeout | null = null
  private snoozeMinutes = 5

  start(settings: AppSettings): void {
    this.applySettings(settings)
    if (!this.intervalHandle) {
      this.intervalHandle = setInterval(() => this.tick(), TICK_MS)
    }
    powerMonitor.on('resume', this.handleSystemResume)
    powerMonitor.on('unlock-screen', this.handleSystemResume)
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    powerMonitor.removeListener('resume', this.handleSystemResume)
    powerMonitor.removeListener('unlock-screen', this.handleSystemResume)
  }

  applySettings(settings: AppSettings): void {
    this.snoozeMinutes = settings.snoozeMinutes
    const now = Date.now()
    const nextBreaks = new Map<string, TrackedBreak>()
    for (const breakType of settings.breakTypes) {
      if (!breakType.enabled) continue
      const existing = this.breaks.get(breakType.id)
      const intervalMs = breakType.intervalMinutes * 60 * 1000
      nextBreaks.set(breakType.id, {
        breakType,
        nextTriggerAt: existing ? Math.min(existing.nextTriggerAt, now + intervalMs) : now + intervalMs
      })
    }
    this.breaks = nextBreaks
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.pausedAt = Date.now()
    this.emitStatus()
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    // Shift every deadline forward by however long we were paused, so time
    // spent paused doesn't count against the countdown.
    const pausedDurationMs = Date.now() - this.pausedAt
    for (const tracked of this.breaks.values()) {
      tracked.nextTriggerAt += pausedDurationMs
    }
    this.emitStatus()
  }

  isPaused(): boolean {
    return this.paused
  }

  snooze(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    tracked.nextTriggerAt = Date.now() + this.snoozeMinutes * 60 * 1000
    this.emitStatus()
  }

  skip(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    tracked.nextTriggerAt = Date.now() + tracked.breakType.intervalMinutes * 60 * 1000
    this.emitStatus()
  }

  getStatuses(): BreakStatus[] {
    const now = Date.now()
    return Array.from(this.breaks.values()).map((tracked) => ({
      breakTypeId: tracked.breakType.id,
      name: tracked.breakType.name,
      msRemaining: Math.max(0, tracked.nextTriggerAt - now),
      paused: this.paused
    }))
  }

  private handleSystemResume = (): void => {
    // The countdown is anchored to wall-clock deadlines, so nothing needs to
    // be recomputed here — just re-check immediately instead of waiting for
    // the next 1s tick, so a break overdue during sleep fires right away.
    this.tick()
  }

  private tick(): void {
    if (this.paused) return
    const now = Date.now()
    for (const tracked of this.breaks.values()) {
      if (tracked.nextTriggerAt <= now) {
        this.emit('trigger', {
          breakTypeId: tracked.breakType.id,
          name: tracked.breakType.name,
          durationSeconds: tracked.breakType.durationSeconds
        })
        tracked.nextTriggerAt = now + tracked.breakType.intervalMinutes * 60 * 1000
      }
    }
    this.emitStatus()
  }

  private emitStatus(): void {
    this.emit('status', this.getStatuses())
  }
}
