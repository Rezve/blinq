import { useEffect, useState } from 'react'
import { AppSettings, BreakStatus, BreakType } from '../../../shared/types'

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function makeId(): string {
  return `break-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

interface NumberFieldProps {
  min: number
  value: number
  onCommit: (value: number) => void
}

// A plain controlled <input> that clamps on every keystroke can never show
// an empty or partial value (e.g. clearing the field to type "20" collapses
// back to the clamped minimum before the next digit lands). This keeps a
// free-form local draft while focused and only parses/clamps on blur.
function NumberField({ min, value, onCommit }: NumberFieldProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    if (draft !== null) {
      const parsed = Math.max(min, Number(draft) || min)
      if (parsed !== value) onCommit(parsed)
      setDraft(null)
    }
  }

  return (
    <input
      type="number"
      min={min}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [statuses, setStatuses] = useState<BreakStatus[]>([])
  const [paused, setPaused] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
    window.api.getTimerStatus().then((s) => {
      setStatuses(s)
      setPaused(s.some((status) => status.paused))
    })

    const offStatus = window.api.onTimerStatus((s) => {
      setStatuses(s)
      setPaused(s.some((status) => status.paused))
    })
    const offSettings = window.api.onSettingsChanged((s) => setSettings(s))

    return () => {
      offStatus()
      offSettings()
    }
  }, [])

  if (!settings) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }

  const persist = async (next: AppSettings): Promise<void> => {
    setSettings(next)
    await window.api.updateSettings(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }

  const updateBreakType = (id: string, patch: Partial<BreakType>): void => {
    const next: AppSettings = {
      ...settings,
      breakTypes: settings.breakTypes.map((bt) => (bt.id === id ? { ...bt, ...patch } : bt))
    }
    persist(next)
  }

  const addBreakType = (): void => {
    const next: AppSettings = {
      ...settings,
      breakTypes: [
        ...settings.breakTypes,
        {
          id: makeId(),
          name: 'New Break',
          intervalMinutes: 30,
          durationSeconds: 30,
          enabled: true
        }
      ]
    }
    persist(next)
  }

  const removeBreakType = (id: string): void => {
    const next: AppSettings = {
      ...settings,
      breakTypes: settings.breakTypes.filter((bt) => bt.id !== id)
    }
    persist(next)
  }

  const togglePause = async (): Promise<void> => {
    if (paused) {
      await window.api.resumeTimers()
    } else {
      await window.api.pauseTimers()
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Break Reminder</h1>
        <div className="header-actions">
          {savedFlash && <span className="saved-flash">Saved</span>}
          <button className={paused ? 'btn primary' : 'btn'} onClick={togglePause}>
            {paused ? 'Resume Timers' : 'Pause Timers'}
          </button>
        </div>
      </header>

      <div className="content-scroll">
      <section className="status-panel">
        <h2>Upcoming Breaks</h2>
        {statuses.length === 0 ? (
          <p className="muted">No active break types. Add one below.</p>
        ) : (
          <ul className="status-list">
            {statuses.map((s) => (
              <li key={s.breakTypeId}>
                <span>{s.name}</span>
                <span className="countdown">{formatRemaining(s.msRemaining)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="section-header">
          <h2>Break Types</h2>
          <button className="btn" onClick={addBreakType}>
            + Add Break Type
          </button>
        </div>

        <div className="break-type-list">
          {settings.breakTypes.map((bt) => (
            <div className="break-type-card" key={bt.id}>
              <div className="row">
                <label>
                  Name
                  <input
                    type="text"
                    value={bt.name}
                    onChange={(e) => updateBreakType(bt.id, { name: e.target.value })}
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={bt.enabled}
                    onChange={(e) => updateBreakType(bt.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="row">
                <label>
                  Every (minutes)
                  <NumberField
                    min={1}
                    value={bt.intervalMinutes}
                    onCommit={(intervalMinutes) => updateBreakType(bt.id, { intervalMinutes })}
                  />
                </label>
                <label>
                  Duration (seconds)
                  <NumberField
                    min={5}
                    value={bt.durationSeconds}
                    onCommit={(durationSeconds) => updateBreakType(bt.id, { durationSeconds })}
                  />
                </label>
                <button className="btn danger" onClick={() => removeBreakType(bt.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>General</h2>
        <div className="row">
          <label>
            Snooze duration (minutes)
            <NumberField
              min={1}
              value={settings.snoozeMinutes}
              onCommit={(snoozeMinutes) => persist({ ...settings, snoozeMinutes })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.launchOnStartup}
              onChange={(e) => persist({ ...settings, launchOnStartup: e.target.checked })}
            />
            Launch on system startup
          </label>
        </div>
      </section>
      </div>
    </div>
  )
}
