import { Menu, nativeImage, Tray } from 'electron'
import { BreakStatus } from '../shared/types'
import { formatDuration, getResourcePath } from './utils'

let tray: Tray | null = null

interface TrayCallbacks {
  onOpenSettings: () => void
  onShowVerse: () => void
  onTogglePause: () => void
  onQuit: () => void
}

function createTrayIcon(): Electron.NativeImage {
  const iconPath = getResourcePath('icon.png')
  const image = nativeImage.createFromPath(iconPath)
  if (!image.isEmpty()) {
    return image.resize({ width: 16, height: 16 })
  }
  return nativeImage.createEmpty()
}

export function createTray(callbacks: TrayCallbacks): Tray {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Break Reminder')
  updateTrayMenu([], false, callbacks)
  return tray
}

export function updateTrayMenu(
  statuses: BreakStatus[],
  paused: boolean,
  callbacks: TrayCallbacks
): void {
  if (!tray) return

  const statusItems =
    statuses.length > 0
      ? statuses.map((status) => ({
          label: `${status.name}: ${formatDuration(status.msRemaining)}`,
          enabled: false
        }))
      : [{ label: 'No break types configured', enabled: false }]

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Break Reminder', enabled: false },
    { type: 'separator' },
    ...statusItems,
    { type: 'separator' },
    {
      label: paused ? 'Resume Timers' : 'Pause Timers',
      click: callbacks.onTogglePause
    },
    { label: 'Show Verse', click: callbacks.onShowVerse },
    { label: 'Open Settings', click: callbacks.onOpenSettings },
    { type: 'separator' },
    {
      label: 'Quit',
      click: callbacks.onQuit
    }
  ])

  tray.setContextMenu(contextMenu)

  if (statuses.length > 0) {
    const next = statuses.reduce((min, s) => (s.msRemaining < min.msRemaining ? s : min))
    tray.setToolTip(
      paused
        ? 'Break Reminder (paused)'
        : `Break Reminder — next: ${next.name} in ${formatDuration(next.msRemaining)}`
    )
  }
}

export function getTray(): Tray | null {
  return tray
}
