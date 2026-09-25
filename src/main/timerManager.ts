import { EventEmitter } from 'events'
import { powerMonitor } from 'electron'
import { AppSettings, BreakStatus, BreakType } from '../shared/types'

interface TrackedBreak {
  breakType: BreakType
  nextTriggerAt: number
}

const TICK_MS = 1000
const MERGE_WINDOW_MS = 60 * 1000
const QUEUE_GAP_MS = 15 * 1000
const ACTIVE_GRACE_SECONDS = 120

export class TimerManager extends EventEmitter {
  private breaks: Map<string, TrackedBreak> = new Map()
  private paused = false
  private pausedAt = 0
  private intervalHandle: NodeJS.Timeout | null = null
  private snoozeMinutes = 5
  private mergeOverlapping = true
  private active: { breakTypeId: string; startedAt: number } | null = null

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
    this.mergeOverlapping = settings.mergeOverlapping ?? true
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
    this.endIfActive(breakTypeId)
    this.emitStatus()
  }

  skip(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    this.restart(tracked, Date.now())
    this.endIfActive(breakTypeId)
    this.emitStatus()
  }

  /** A finished break also resets every shorter break it covers. */
  complete(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    const now = Date.now()
    this.restart(tracked, now)
    if (this.mergeOverlapping) {
      for (const t of this.breaks.values()) {
        if (t.breakType.durationSeconds < tracked.breakType.durationSeconds) this.restart(t, now)
      }
    }
    this.endIfActive(breakTypeId)
    this.emitStatus()
  }

  private endIfActive(breakTypeId: string): void {
    if (this.active?.breakTypeId === breakTypeId) this.finishActive()
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
    this.expireStaleActive(now)
    // Only one overlay at a time; anything due meanwhile waits (it stays due).
    if (!this.active) this.triggerNext(now)
    this.emitStatus()
  }

  private triggerNext(now: number): void {
    const all = Array.from(this.breaks.values())
    if (!all.some((t) => t.nextTriggerAt <= now)) return

    // Reminders due within the merge window are treated as overlapping.
    const window = this.mergeOverlapping ? MERGE_WINDOW_MS : 0
    const candidates = all.filter((t) => t.nextTriggerAt <= now + window)
    const winner = candidates.reduce((best, t) =>
      t.breakType.durationSeconds > best.breakType.durationSeconds ? t : best
    )

    if (this.mergeOverlapping) {
      // Shorter breaks are covered by the longer one; restart their countdowns.
      for (const t of candidates) {
        if (t !== winner && t.breakType.durationSeconds <= winner.breakType.durationSeconds) {
          this.restart(t, now)
        }
      }
    }

    this.active = { breakTypeId: winner.breakType.id, startedAt: now }
    this.emit('trigger', {
      breakTypeId: winner.breakType.id,
      name: winner.breakType.name,
      durationSeconds: winner.breakType.durationSeconds
    })
  }

  private restart(tracked: TrackedBreak, now: number): void {
    tracked.nextTriggerAt = now + tracked.breakType.intervalMinutes * 60 * 1000
  }

  private expireStaleActive(now: number): void {
    if (!this.active) return
    const tracked = this.breaks.get(this.active.breakTypeId)
    const limitMs = ((tracked?.breakType.durationSeconds ?? 0) + ACTIVE_GRACE_SECONDS) * 1000
    if (now - this.active.startedAt > limitMs) this.finishActive()
  }

  private finishActive(): void {
    this.active = null
    // Space out any reminder that queued up behind the one that just ended.
    const now = Date.now()
    for (const t of this.breaks.values()) {
      if (t.nextTriggerAt < now + QUEUE_GAP_MS) t.nextTriggerAt = now + QUEUE_GAP_MS
    }
  }

  private emitStatus(): void {
    this.emit('status', this.getStatuses())
  }
}
