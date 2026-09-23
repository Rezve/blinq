import type { BreakReminderApi } from './index'

declare global {
  interface Window {
    api: BreakReminderApi
  }
}
