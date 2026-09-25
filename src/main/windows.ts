import { BrowserWindow, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { getResourcePath, is } from './utils'

let settingsWindow: BrowserWindow | null = null
let welcomeWindow: BrowserWindow | null = null
let reminderWindows: BrowserWindow[] = []

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
    title: 'Blinq',
    backgroundColor: '#14161a',
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

export function createWelcomeWindow(): BrowserWindow {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.show()
    welcomeWindow.focus()
    return welcomeWindow
  }

  const display = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    ...display.workArea,
    frame: false,
    movable: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Blinq',
    icon: appIcon,
    backgroundColor: '#0c0e12',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  welcomeWindow = win
  // Re-apply bounds so mixed-DPI setups size it against the right display.
  win.setBounds(display.workArea)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      win.close()
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    welcomeWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/welcome.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/welcome.html'))
  }

  return win
}

export function closeWelcomeWindow(): void {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) welcomeWindow.close()
}

function createReminderWindowForDisplay(display: Electron.Display): BrowserWindow {
  const { width, height } = display.workAreaSize

  const win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x,
    y: display.workArea.y,
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

  // On Windows, when displays have different DPI scale factors, Chromium can
  // size/position a BrowserWindow using the wrong monitor's scale at
  // construction time, leaving it not actually covering the target screen.
  // Re-applying the same bounds once the window exists forces it to
  // recompute against the display it's actually on.
  win.setBounds({
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workAreaSize.width,
    height: display.workAreaSize.height
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('closed', () => {
    reminderWindows = reminderWindows.filter((w) => w !== win)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/reminder.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/reminder.html'))
  }

  return win
}

// Rebuilt from the live display list on every call (rather than reused)
// so a monitor plugged/unplugged since the last break is picked up, and so
// every connected screen gets its own overlay, not just the primary one.
export function createReminderWindows(): BrowserWindow[] {
  destroyReminderWindows()
  reminderWindows = screen.getAllDisplays().map(createReminderWindowForDisplay)
  return reminderWindows
}

export function getReminderWindows(): BrowserWindow[] {
  return reminderWindows
}

export function hideReminderWindows(): void {
  for (const win of reminderWindows) {
    if (!win.isDestroyed()) win.hide()
  }
}

function destroyReminderWindows(): void {
  for (const win of reminderWindows) {
    if (!win.isDestroyed()) win.destroy()
  }
  reminderWindows = []
}
