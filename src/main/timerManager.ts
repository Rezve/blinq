import { EventEmitter } from 'events'
import { AppSettings, BreakStatus, BreakType } from '../shared/types'

interface TrackedBreak {
  breakType: BreakType
  msRemaining: number
}

const TICK_MS = 1000

export class TimerManager extends EventEmitter {
  private breaks: Map<string, TrackedBreak> = new Map()
  private paused = false
  private intervalHandle: NodeJS.Timeout | null = null
  private snoozeMinutes = 5

  start(settings: AppSettings): void {
    this.applySettings(settings)
    if (!this.intervalHandle) {
      this.intervalHandle = setInterval(() => this.tick(), TICK_MS)
    }
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  applySettings(settings: AppSettings): void {
    this.snoozeMinutes = settings.snoozeMinutes
    const nextBreaks = new Map<string, TrackedBreak>()
    for (const breakType of settings.breakTypes) {
      if (!breakType.enabled) continue
      const existing = this.breaks.get(breakType.id)
      const intervalMs = breakType.intervalMinutes * 60 * 1000
      nextBreaks.set(breakType.id, {
        breakType,
        msRemaining: existing ? Math.min(existing.msRemaining, intervalMs) : intervalMs
      })
    }
    this.breaks = nextBreaks
  }

  pause(): void {
    this.paused = true
    this.emitStatus()
  }

  resume(): void {
    this.paused = false
    this.emitStatus()
  }

  isPaused(): boolean {
    return this.paused
  }

  snooze(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    tracked.msRemaining = this.snoozeMinutes * 60 * 1000
    this.emitStatus()
  }

  skip(breakTypeId: string): void {
    const tracked = this.breaks.get(breakTypeId)
    if (!tracked) return
    tracked.msRemaining = tracked.breakType.intervalMinutes * 60 * 1000
    this.emitStatus()
  }

  getStatuses(): BreakStatus[] {
    return Array.from(this.breaks.values()).map((tracked) => ({
      breakTypeId: tracked.breakType.id,
      name: tracked.breakType.name,
      msRemaining: tracked.msRemaining,
      paused: this.paused
    }))
  }

  private tick(): void {
    if (this.paused) return
    for (const tracked of this.breaks.values()) {
      tracked.msRemaining -= TICK_MS
      if (tracked.msRemaining <= 0) {
        this.emit('trigger', {
          breakTypeId: tracked.breakType.id,
          name: tracked.breakType.name,
          durationSeconds: tracked.breakType.durationSeconds
        })
        tracked.msRemaining = tracked.breakType.intervalMinutes * 60 * 1000
      }
    }
    this.emitStatus()
  }

  private emitStatus(): void {
    this.emit('status', this.getStatuses())
  }
}
