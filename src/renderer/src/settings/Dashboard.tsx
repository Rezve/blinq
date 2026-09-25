import { useMemo, useState } from 'react'
import { BreakStatus, BreakType, HistoryEntry } from '../../../shared/types'
import UpcomingBreaks from './UpcomingBreaks'

const DAY_MS = 24 * 60 * 60 * 1000

type Range = 'today' | 'week' | 'month' | 'year'

const RANGES: { id: Range; label: string; title: string }[] = [
  { id: 'today', label: 'Today', title: 'Today by Hour' },
  { id: 'week', label: 'Week', title: 'Last 7 Days' },
  { id: 'month', label: 'Month', title: 'Last 30 Days' },
  { id: 'year', label: 'Year', title: 'Last 12 Months' }
]

function dayKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function monthKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}`
}

interface Bucket {
  key: string
  label: string
  fullLabel: string
  completed: number
  skipped: number
  snoozed: number
}

function hourKey(timestamp: number): string {
  return `${dayKey(timestamp)}-${new Date(timestamp).getHours()}`
}

function bucketKeyFn(range: Range): (timestamp: number) => string {
  if (range === 'today') return hourKey
  return range === 'year' ? monthKey : dayKey
}

function buildBuckets(entries: HistoryEntry[], range: Range): Bucket[] {
  const now = new Date()
  const buckets: Bucket[] = []
  if (range === 'today') {
    for (let h = 0; h < 24; h++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h)
      buckets.push({
        key: hourKey(d.getTime()),
        label: h % 6 === 0 ? d.toLocaleTimeString(undefined, { hour: 'numeric' }) : '',
        fullLabel: d.toLocaleTimeString(undefined, { hour: 'numeric' }),
        completed: 0,
        skipped: 0,
        snoozed: 0
      })
    }
  } else if (range === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: monthKey(d.getTime()),
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        fullLabel: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        completed: 0,
        skipped: 0,
        snoozed: 0
      })
    }
  } else {
    const days = range === 'week' ? 7 : 30
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const showLabel = range === 'week' || i === 0 || i % 5 === 0
      buckets.push({
        key: dayKey(d.getTime()),
        label: !showLabel
          ? ''
          : range === 'week'
            ? d.toLocaleDateString(undefined, { weekday: 'short' })
            : String(d.getDate()),
        fullLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        completed: 0,
        skipped: 0,
        snoozed: 0
      })
    }
  }
  const keyFn = bucketKeyFn(range)
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const entry of entries) {
    const bucket = byKey.get(keyFn(entry.timestamp))
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
  statuses: BreakStatus[]
  breakTypes: BreakType[]
}

export default function Dashboard({ history, statuses, breakTypes }: DashboardProps): JSX.Element {
  const [range, setRange] = useState<Range>('today')
  const buckets = useMemo(() => buildBuckets(history, range), [history, range])
  const streak = useMemo(() => computeStreak(history), [history])

  const keyFn = bucketKeyFn(range)
  const todayKey = dayKey(Date.now())
  // Nothing selected means "today", in every range. Clicking a bar narrows to that bucket.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const activeKey = selectedKey
  // Week/month highlight today's bar by default; today/year have no single "today" bar.
  const highlightKey = selectedKey ?? (range === 'week' || range === 'month' ? todayKey : null)
  const isToday = selectedKey === null
  const activeBucket = buckets.find((b) => b.key === activeKey)
  const activeLabel = isToday ? 'today' : (activeBucket?.fullLabel ?? '')

  const dayEntries = useMemo(
    () =>
      history.filter((e) =>
        activeKey === null ? dayKey(e.timestamp) === todayKey : keyFn(e.timestamp) === activeKey
      ),
    [history, activeKey, range, todayKey]
  )
  const breakTypeStats = useMemo(() => computeBreakTypeStats(dayEntries), [dayEntries])

  const dayCompleted = dayEntries.filter((e) => e.action === 'completed').length
  const daySkipped = dayEntries.filter((e) => e.action === 'skipped').length
  const dayResolved = dayCompleted + daySkipped
  const compliance = dayResolved === 0 ? null : Math.round((dayCompleted / dayResolved) * 100)

  const maxCount = Math.max(1, ...buckets.map((b) => b.completed + b.skipped))

  return (
    <div className="dashboard">
      <UpcomingBreaks statuses={statuses} breakTypes={breakTypes} />

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{dayCompleted}</span>
          <span className="stat-label">Breaks taken {activeLabel}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{compliance === null ? '—' : `${compliance}%`}</span>
          <span className="stat-label">Compliance {activeLabel}</span>
        </div>
      </div>

      <section>
        <div className="range-header">
          <h2>{RANGES.find((r) => r.id === range)?.title}</h2>
          <div className="range-toggle" role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`range-btn${r.id === range ? ' active' : ''}`}
                aria-pressed={r.id === range}
                onClick={() => {
                  setRange(r.id)
                  setSelectedKey(null)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="muted">No break activity recorded yet.</p>
        ) : (
          <div className={`bar-chart${range === 'month' || range === 'today' ? ' dense' : ''}`}>
            {buckets.map((b) => {
              const total = b.completed + b.skipped
              const completedPct = total === 0 ? 0 : (b.completed / maxCount) * 100
              const skippedPct = total === 0 ? 0 : (b.skipped / maxCount) * 100
              return (
                <button
                  type="button"
                  className={`bar-col${b.key === highlightKey ? ' selected' : ''}`}
                  key={b.key}
                  onClick={() => setSelectedKey(b.key === highlightKey ? null : b.key)}
                  aria-pressed={b.key === highlightKey}
                >
                  <div className="bar-track">
                    <div className="bar-segment skipped" style={{ height: `${skippedPct}%` }} />
                    <div className="bar-segment completed" style={{ height: `${completedPct}%` }} />
                  </div>
                  <span className="bar-label">{b.label}</span>
                </button>
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
        <h2>By Break Type ({isToday ? 'Today' : activeLabel})</h2>
        {breakTypeStats.length === 0 ? (
          <p className="muted">Nothing to show for this period.</p>
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
