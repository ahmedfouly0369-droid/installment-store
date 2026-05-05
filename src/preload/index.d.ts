import { ElectronAPI } from '@electron-toolkit/preload'

interface ApiBridge {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ApiBridge
  }
}

export {}
