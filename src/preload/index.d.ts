import type { BlinqApi } from './index'

declare global {
  interface Window {
    api: BlinqApi
  }
}
