export interface BreakType {
  id: string
  name: string
  intervalMinutes: number
  durationSeconds: number
  enabled: boolean
}

export interface AppSettings {
  breakTypes: BreakType[]
  snoozeMinutes: number
  launchOnStartup: boolean
}

export interface BreakStatus {
  breakTypeId: string
  name: string
  msRemaining: number
  paused: boolean
}

export interface ReminderPayload {
  breakTypeId: string
  name: string
  durationSeconds: number
}

export type HistoryAction = 'completed' | 'skipped' | 'snoozed'

export interface HistoryEntry {
  breakTypeId: string
  name: string
  action: HistoryAction
  timestamp: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  breakTypes: [
    {
      id: 'short-break',
      name: 'Short Break',
      intervalMinutes: 20,
      durationSeconds: 20,
      enabled: true
    },
    {
      id: 'long-break',
      name: 'Long Break',
      intervalMinutes: 60,
      durationSeconds: 300,
      enabled: true
    }
  ],
  snoozeMinutes: 5,
  launchOnStartup: false
}

export const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_CHANGED: 'settings:changed',
  TIMER_PAUSE: 'timer:pause',
  TIMER_RESUME: 'timer:resume',
  TIMER_STATUS: 'timer:status',
  TIMER_TICK: 'timer:tick',
  REMINDER_TRIGGER: 'reminder:trigger',
  REMINDER_SNOOZE: 'reminder:snooze',
  REMINDER_SKIP: 'reminder:skip',
  REMINDER_COMPLETE: 'reminder:complete',
  HISTORY_GET: 'history:get',
  HISTORY_CHANGED: 'history:changed'
} as const
