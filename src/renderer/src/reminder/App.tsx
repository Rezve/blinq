import { useEffect, useRef, useState } from 'react'
import { ReminderPayload } from '../../../shared/types'

export default function App(): JSX.Element {
  const [payload, setPayload] = useState<ReminderPayload | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const off = window.api.onReminderTrigger((p) => {
      setPayload(p)
      setSecondsLeft(p.durationSeconds)
    })
    return () => off()
  }, [])

  useEffect(() => {
    if (!payload) return

    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          window.api.skipReminder(payload.breakTypeId)
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [payload])

  if (!payload) {
    return <div className="overlay" />
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <div className="overlay">
      <div className="content">
        <p className="eyebrow">Time for a break</p>
        <h1>{payload.name}</h1>
        <div className="timer">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <p className="hint">Step away from the screen, stretch, and breathe.</p>
        <div className="actions">
          <button className="btn" onClick={() => window.api.snoozeReminder(payload.breakTypeId)}>
            Snooze
          </button>
          <button className="btn primary" onClick={() => window.api.skipReminder(payload.breakTypeId)}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
