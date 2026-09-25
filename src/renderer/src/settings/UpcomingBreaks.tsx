import { BreakStatus, BreakType } from '../../../shared/types'

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const ss = seconds.toString().padStart(2, '0')
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`
  return `${minutes}:${ss}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m}m ${s}s`
}

const RING_RADIUS = 24
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface UpcomingBreaksProps {
  statuses: BreakStatus[]
  breakTypes: BreakType[]
}

export default function UpcomingBreaks({ statuses, breakTypes }: UpcomingBreaksProps): JSX.Element {
  const typesById = new Map(breakTypes.map((bt) => [bt.id, bt]))
  const items = [...statuses].sort((a, b) => a.msRemaining - b.msRemaining)

  return (
    <section>
      <h2>Upcoming Breaks</h2>
      {items.length === 0 ? (
        <p className="muted">No active break types. Add one in Settings.</p>
      ) : (
        <div className="upcoming-grid">
          {items.map((s, index) => {
            const type = typesById.get(s.breakTypeId)
            const intervalMs = (type?.intervalMinutes ?? 0) * 60 * 1000
            const elapsed = intervalMs > 0 ? 1 - s.msRemaining / intervalMs : 0
            const progress = Math.min(1, Math.max(0, elapsed))
            const isNext = index === 0 && !s.paused
            return (
              <div
                key={s.breakTypeId}
                className={`upcoming-card${isNext ? ' next' : ''}${s.paused ? ' paused' : ''}`}
              >
                <svg className="upcoming-ring" viewBox="0 0 56 56" aria-hidden="true">
                  <circle className="ring-track" cx="28" cy="28" r={RING_RADIUS} />
                  <circle
                    className="ring-progress"
                    cx="28"
                    cy="28"
                    r={RING_RADIUS}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                  />
                </svg>
                <div className="upcoming-body">
                  <div className="upcoming-name" title={s.name}>
                    {s.name}
                  </div>
                  <div className="upcoming-time">{formatRemaining(s.msRemaining)}</div>
                  {type && (
                    <div className="upcoming-meta">
                      Every {type.intervalMinutes} min · {formatDuration(type.durationSeconds)}
                    </div>
                  )}
                </div>
                {s.paused ? (
                  <span className="upcoming-badge">Paused</span>
                ) : isNext ? (
                  <span className="upcoming-badge next">Next up</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
