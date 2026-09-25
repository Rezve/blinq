import { contextBridge, ipcRenderer } from 'electron'
import { AppSettings, BreakStatus, HistoryEntry, IPC_CHANNELS, ReminderPayload, Verse } from '../shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (_event: unknown, settings: AppSettings): void => callback(settings)
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, listener)
    }
  },

  pauseTimers: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.TIMER_PAUSE),
  resumeTimers: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.TIMER_RESUME),
  getTimerStatus: (): Promise<BreakStatus[]> => ipcRenderer.invoke(IPC_CHANNELS.TIMER_STATUS),
  onTimerStatus: (callback: (statuses: BreakStatus[]) => void): (() => void) => {
    const listener = (_event: unknown, statuses: BreakStatus[]): void => callback(statuses)
    ipcRenderer.on(IPC_CHANNELS.TIMER_STATUS, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TIMER_STATUS, listener)
    }
  },

  onReminderTrigger: (callback: (payload: ReminderPayload) => void): (() => void) => {
    const listener = (_event: unknown, payload: ReminderPayload): void => callback(payload)
    ipcRenderer.on(IPC_CHANNELS.REMINDER_TRIGGER, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.REMINDER_TRIGGER, listener)
    }
  },
  snoozeReminder: (breakTypeId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMINDER_SNOOZE, breakTypeId),
  skipReminder: (breakTypeId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMINDER_SKIP, breakTypeId),
  completeReminder: (breakTypeId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMINDER_COMPLETE, breakTypeId),

  getWelcomeVerse: (): Promise<Verse> => ipcRenderer.invoke(IPC_CHANNELS.WELCOME_VERSE),
  welcomeOpenSettings: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WELCOME_OPEN_SETTINGS),
  showWelcome: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WELCOME_SHOW),
  welcomeDismiss: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WELCOME_DISMISS),

  getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET),
  onHistoryChanged: (callback: (entries: HistoryEntry[]) => void): (() => void) => {
    const listener = (_event: unknown, entries: HistoryEntry[]): void => callback(entries)
    ipcRenderer.on(IPC_CHANNELS.HISTORY_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.HISTORY_CHANGED, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type BreakReminderApi = typeof api
