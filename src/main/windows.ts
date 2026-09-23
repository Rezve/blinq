import { BrowserWindow, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { getResourcePath, is } from './utils'

let settingsWindow: BrowserWindow | null = null
let reminderWindow: BrowserWindow | null = null

const appIcon = nativeImage.createFromPath(getResourcePath('icon.png'))

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 640,
    height: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Break Reminder — Settings',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('close', (event) => {
    if (!(global as any).__quitting) {
      event.preventDefault()
      settingsWindow?.hide()
    }
  })

  settingsWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return settingsWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function createReminderWindow(): BrowserWindow {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    return reminderWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  reminderWindow = new BrowserWindow({
    width,
    height,
    x: primaryDisplay.workArea.x,
    y: primaryDisplay.workArea.y,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  reminderWindow.setAlwaysOnTop(true, 'screen-saver')
  reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  reminderWindow.on('closed', () => {
    reminderWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    reminderWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/reminder.html`)
  } else {
    reminderWindow.loadFile(join(__dirname, '../renderer/reminder.html'))
  }

  return reminderWindow
}

export function getReminderWindow(): BrowserWindow | null {
  return reminderWindow
}

export function hideReminderWindow(): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.hide()
  }
}
