import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { HistoryEntry } from '../shared/types'

const historyPath = join(app.getPath('userData'), 'history.json')

const MAX_ENTRIES = 2000
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

let cache: HistoryEntry[] | null = null

function readFromDisk(): HistoryEntry[] {
  if (!existsSync(historyPath)) return []
  try {
    const raw = readFileSync(historyPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(entries: HistoryEntry[]): void {
  const dir = dirname(historyPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(historyPath, JSON.stringify(entries, null, 2), 'utf-8')
}

export function loadHistory(): HistoryEntry[] {
  if (!cache) cache = readFromDisk()
  return cache
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS
  const next = [...loadHistory(), entry]
    .filter((e) => e.timestamp >= cutoff)
    .slice(-MAX_ENTRIES)
  cache = next
  persist(next)
  return next
}
