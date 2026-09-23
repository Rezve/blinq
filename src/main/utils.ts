import { app } from 'electron'
import { join } from 'path'

export const is = {
  dev: !!process.env['ELECTRON_RENDERER_URL'] || process.env.NODE_ENV === 'development'
}

// In dev, __dirname (out/main) sits two levels under the project root, so
// '../../resources' reaches it directly. Once packaged, the app runs from
// inside app.asar while extraResources are copied next to it under
// process.resourcesPath instead, so the dev-relative path no longer exists.
export function getResourcePath(...segments: string[]): string {
  const base = app.isPackaged ? join(process.resourcesPath, 'resources') : join(__dirname, '../../resources')
  return join(base, ...segments)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
