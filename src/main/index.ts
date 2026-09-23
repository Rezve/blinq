import { app, BrowserWindow, ipcMain } from 'electron'
import { AppSettings, BreakStatus, IPC_CHANNELS, ReminderPayload } from '../shared/types'
import { loadSettings, saveSettings } from './settingsStore'
import { TimerManager } from './timerManager'
import { createTray, updateTrayMenu } from './tray'
import {
  createReminderWindows,
  createSettingsWindow,
  getSettingsWindow,
  hideReminderWindows
} from './windows'

const timerManager = new TimerManager()
let settings: AppSettings = loadSettings()

function applyLoginItemSetting(): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup })
  }
}

function broadcastStatus(statuses: BreakStatus[]): void {
  updateTrayMenu(statuses, timerManager.isPaused(), trayCallbacks)
  const settingsWindow = getSettingsWindow()
  if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.webContents.isDestroyed()) {
    try {
      settingsWindow.webContents.send(IPC_CHANNELS.TIMER_STATUS, statuses)
    } catch {
      // window torn down mid-send during shutdown; ignore
    }
  }
}

function handleReminderTrigger(payload: ReminderPayload): void {
  for (const win of createReminderWindows()) {
    const send = (): void => win.webContents.send(IPC_CHANNELS.REMINDER_TRIGGER, payload)
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', send)
    } else {
      send()
    }
    win.show()
    win.focus()
  }
}

const trayCallbacks = {
  onOpenSettings: () => {
    createSettingsWindow()
  },
  onTogglePause: () => {
    if (timerManager.isPaused()) {
      timerManager.resume()
    } else {
      timerManager.pause()
    }
  },
  onQuit: () => {
    ;(global as any).__quitting = true
    app.quit()
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => settings)

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, updated: AppSettings) => {
    settings = updated
    saveSettings(settings)
    timerManager.applySettings(settings)
    applyLoginItemSetting()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, settings)
      }
    }
    return settings
  })

  ipcMain.handle(IPC_CHANNELS.TIMER_PAUSE, () => {
    timerManager.pause()
  })

  ipcMain.handle(IPC_CHANNELS.TIMER_RESUME, () => {
    timerManager.resume()
  })

  ipcMain.handle(IPC_CHANNELS.TIMER_STATUS, () => timerManager.getStatuses())

  ipcMain.handle(IPC_CHANNELS.REMINDER_SNOOZE, (_event, breakTypeId: string) => {
    timerManager.snooze(breakTypeId)
    hideReminderWindows()
  })

  ipcMain.handle(IPC_CHANNELS.REMINDER_SKIP, (_event, breakTypeId: string) => {
    timerManager.skip(breakTypeId)
    hideReminderWindows()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  applyLoginItemSetting()

  timerManager.on('trigger', handleReminderTrigger)
  timerManager.on('status', broadcastStatus)
  timerManager.start(settings)

  createTray(trayCallbacks)
  createSettingsWindow()

  app.on('activate', () => {
    createSettingsWindow()
  })
})

app.on('window-all-closed', () => {
  // Keep running in the tray; do not quit here.
})

app.on('before-quit', () => {
  ;(global as any).__quitting = true
  timerManager.stop()
})
