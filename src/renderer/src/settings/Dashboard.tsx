import { useMemo } from 'react'
import { HistoryEntry } from '../../../shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7

function dayKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' })
}

interface DayBucket {
  key: string
  label: string
  completed: number
  skipped: number
  snoozed: number
}

function buildDayBuckets(entries: HistoryEntry[]): DayBucket[] {
  const now = Date.now()
  const buckets: DayBucket[] = []
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const t = now - i * DAY_MS
    buckets.push({ key: dayKey(t), label: dayLabel(t), completed: 0, skipped: 0, snoozed: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const entry of entries) {
    const bucket = byKey.get(dayKey(entry.timestamp))
    if (!bucket) continue
    if (entry.action === 'completed') bucket.completed++
    else if (entry.action === 'skipped') bucket.skipped++
    else bucket.snoozed++
  }
  return buckets
}

function computeStreak(entries: HistoryEntry[]): number {
  const completedDays = new Set(entries.filter((e) => e.action === 'completed').map((e) => dayKey(e.timestamp)))
  let streak = 0
  let cursor = Date.now()
  while (completedDays.has(dayKey(cursor))) {
    streak++
    cursor -= DAY_MS
  }
  return streak
}

interface BreakTypeStat {
  name: string
  completed: number
  skipped: number
  snoozed: number
  compliance: number | null
}

function computeBreakTypeStats(entries: HistoryEntry[]): BreakTypeStat[] {
  const byId = new Map<string, BreakTypeStat>()
  for (const entry of entries) {
    const existing = byId.get(entry.breakTypeId) ?? {
      name: entry.name,
      completed: 0,
      skipped: 0,
      snoozed: 0,
      compliance: null
    }
    existing.name = entry.name
    if (entry.action === 'completed') existing.completed++
    else if (entry.action === 'skipped') existing.skipped++
    else existing.snoozed++
    byId.set(entry.breakTypeId, existing)
  }
  const stats = Array.from(byId.values())
  for (const stat of stats) {
    const resolved = stat.completed + stat.skipped
    stat.compliance = resolved === 0 ? null : Math.round((stat.completed / resolved) * 100)
  }
  return stats.sort((a, b) => b.completed + b.skipped - (a.completed + a.skipped))
}

interface DashboardProps {
  history: HistoryEntry[]
}

export default function Dashboard({ history }: DashboardProps): JSX.Element {
  const buckets = useMemo(() => buildDayBuckets(history), [history])
  const streak = useMemo(() => computeStreak(history), [history])
  const breakTypeStats = useMemo(() => computeBreakTypeStats(history), [history])

  const windowStart = Date.now() - WINDOW_DAYS * DAY_MS
  const windowEntries = history.filter((e) => e.timestamp >= windowStart)
  const weekCompleted = windowEntries.filter((e) => e.action === 'completed').length
  const weekSkipped = windowEntries.filter((e) => e.action === 'skipped').length
  const weekResolved = weekCompleted + weekSkipped
  const compliance = weekResolved === 0 ? null : Math.round((weekCompleted / weekResolved) * 100)

  const todayKey = dayKey(Date.now())
  const todayEntries = history.filter((e) => dayKey(e.timestamp) === todayKey)
  const todayCompleted = todayEntries.filter((e) => e.action === 'completed').length

  const maxCount = Math.max(1, ...buckets.map((b) => b.completed + b.skipped))

  return (
    <div className="dashboard">
      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{todayCompleted}</span>
          <span className="stat-label">Breaks taken today</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{compliance === null ? '—' : `${compliance}%`}</span>
          <span className="stat-label">7-day compliance</span>
        </div>
      </div>

      <section>
        <h2>Last 7 Days</h2>
        {history.length === 0 ? (
          <p className="muted">No break activity recorded yet.</p>
        ) : (
          <div className="bar-chart">
            {buckets.map((b) => {
              const total = b.completed + b.skipped
              const completedPct = total === 0 ? 0 : (b.completed / maxCount) * 100
              const skippedPct = total === 0 ? 0 : (b.skipped / maxCount) * 100
              return (
                <div className="bar-col" key={b.key}>
                  <div className="bar-track">
                    <div className="bar-segment skipped" style={{ height: `${skippedPct}%` }} />
                    <div className="bar-segment completed" style={{ height: `${completedPct}%` }} />
                  </div>
                  <span className="bar-label">{b.label}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch completed" /> Taken
          </span>
          <span className="legend-item">
            <span className="legend-swatch skipped" /> Skipped
          </span>
        </div>
      </section>

      <section>
        <h2>By Break Type</h2>
        {breakTypeStats.length === 0 ? (
          <p className="muted">Nothing to show yet.</p>
        ) : (
          <table className="stat-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Taken</th>
                <th>Skipped</th>
                <th>Snoozed</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {breakTypeStats.map((stat) => (
                <tr key={stat.name}>
                  <td>{stat.name}</td>
                  <td>{stat.completed}</td>
                  <td>{stat.skipped}</td>
                  <td>{stat.snoozed}</td>
                  <td>{stat.compliance === null ? '—' : `${stat.compliance}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
