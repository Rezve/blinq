import { app, BrowserWindow, ipcMain } from 'electron'
import { AppSettings, BreakStatus, HistoryAction, IPC_CHANNELS, ReminderPayload } from '../shared/types'
import { addHistoryEntry, loadHistory } from './historyStore'
import { loadSettings, saveSettings } from './settingsStore'
import { getRandomVerse } from './verses'
import { TimerManager } from './timerManager'
import { createTray, updateTrayMenu } from './tray'
import {
  closeWelcomeWindow,
  createReminderWindows,
  createSettingsWindow,
  createWelcomeWindow,
  getSettingsWindow,
  hideReminderWindows
} from './windows'

const timerManager = new TimerManager()
let settings: AppSettings = loadSettings()

function applyLoginItemSetting(): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    // In dev the executable is the bare electron.exe; registering it as a login item
    // launches Electron's default "get started" window (no app path) at startup.
    app.setLoginItemSettings({ openAtLogin: app.isPackaged && settings.launchOnStartup })
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

function recordHistory(breakTypeId: string, action: HistoryAction): void {
  const name = settings.breakTypes.find((bt) => bt.id === breakTypeId)?.name ?? breakTypeId
  const entries = addHistoryEntry({ breakTypeId, name, action, timestamp: Date.now() })
  const settingsWindow = getSettingsWindow()
  if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.webContents.isDestroyed()) {
    try {
      settingsWindow.webContents.send(IPC_CHANNELS.HISTORY_CHANGED, entries)
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
  onShowVerse: () => {
    createWelcomeWindow()
  },
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
    recordHistory(breakTypeId, 'snoozed')
  })

  ipcMain.handle(IPC_CHANNELS.REMINDER_SKIP, (_event, breakTypeId: string) => {
    timerManager.skip(breakTypeId)
    hideReminderWindows()
    recordHistory(breakTypeId, 'skipped')
  })

  ipcMain.handle(IPC_CHANNELS.REMINDER_COMPLETE, (_event, breakTypeId: string) => {
    timerManager.complete(breakTypeId)
    hideReminderWindows()
    recordHistory(breakTypeId, 'completed')
  })

  ipcMain.handle(IPC_CHANNELS.WELCOME_VERSE, () => getRandomVerse())
  ipcMain.handle(IPC_CHANNELS.WELCOME_OPEN_SETTINGS, () => {
    closeWelcomeWindow()
    createSettingsWindow()
  })
  ipcMain.handle(IPC_CHANNELS.WELCOME_SHOW, () => {
    createWelcomeWindow()
  })
  ipcMain.handle(IPC_CHANNELS.WELCOME_DISMISS, () => closeWelcomeWindow())

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, () => loadHistory())
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', () => {
  createSettingsWindow()
})

app.whenReady().then(() => {
  if (!gotLock) return
  registerIpcHandlers()
  applyLoginItemSetting()

  timerManager.on('trigger', handleReminderTrigger)
  timerManager.on('status', broadcastStatus)
  timerManager.start(settings)

  createTray(trayCallbacks)
  createWelcomeWindow()

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
