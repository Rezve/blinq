import { contextBridge, ipcRenderer } from 'electron'
import { AppSettings, BreakStatus, IPC_CHANNELS, ReminderPayload } from '../shared/types'

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
    ipcRenderer.invoke(IPC_CHANNELS.REMINDER_SKIP, breakTypeId)
}

contextBridge.exposeInMainWorld('api', api)

export type BreakReminderApi = typeof api
