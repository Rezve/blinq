import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getResourcePath } from './utils'
import { AppSettings, DEFAULT_SETTINGS, IPC_CHANNELS, UpdateStatus } from '../shared/types'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const STARTUP_DELAY_MS = 15 * 1000

let status: UpdateStatus = { state: 'idle' }
let openSettings: () => void = () => {}
let getSettings: () => AppSettings = () => DEFAULT_SETTINGS

function setStatus(next: UpdateStatus): void {
  status = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, status)
    }
  }
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, icon: getResourcePath('icon.png') })
  n.on('click', openSettings)
  n.show()
}

async function checkForUpdates(): Promise<void> {
  autoUpdater.autoDownload = getSettings().autoUpdate
  if (!app.isPackaged) {
    setStatus({ state: 'error', message: 'Updates are only available in the installed app.' })
    return
  }
  // Don't restart the check while a download is in flight or already finished.
  if (status.state === 'checking' || status.state === 'downloading' || status.state === 'downloaded') return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function initAutoUpdater(onOpenSettings: () => void, settingsGetter: () => AppSettings): void {
  openSettings = onOpenSettings
  getSettings = settingsGetter

  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_STATUS, () => status)
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, () => checkForUpdates())
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    if (status.state !== 'available') return
    const { version } = status
    setStatus({ state: 'downloading', version, percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  })
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    if (status.state !== 'downloaded') return
    ;(global as any).__quitting = true
    autoUpdater.quitAndInstall(true, true)
  })

  autoUpdater.autoDownload = getSettings().autoUpdate
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    setStatus({ state: 'available', version: info.version })
    notify(
      'Blinq update available',
      getSettings().autoUpdate
        ? `Version ${info.version} is downloading…`
        : `Version ${info.version} is available. Click to open settings and download it.`
    )
  })
  autoUpdater.on('update-not-available', () => setStatus({ state: 'up-to-date' }))
  autoUpdater.on('download-progress', (p) => {
    const version = status.state === 'available' || status.state === 'downloading' ? status.version : ''
    setStatus({ state: 'downloading', version, percent: p.percent })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setStatus({ state: 'downloaded', version: info.version })
    notify('Blinq update ready', `Version ${info.version} will install when you quit, or click to restart now.`)
  })
  autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }))

  if (!app.isPackaged) return
  const scheduledCheck = (): void => {
    if (getSettings().checkForUpdates) void checkForUpdates()
  }
  setTimeout(scheduledCheck, STARTUP_DELAY_MS)
  setInterval(scheduledCheck, CHECK_INTERVAL_MS)
}
