import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

const settingsPath = join(app.getPath('userData'), 'settings.json')

function cloneDefaults(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
}

export function loadSettings(): AppSettings {
  if (!existsSync(settingsPath)) {
    return cloneDefaults()
  }
  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      ...cloneDefaults(),
      ...parsed
    }
  } catch {
    return cloneDefaults()
  }
}

export function saveSettings(settings: AppSettings): void {
  const dir = dirname(settingsPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}
