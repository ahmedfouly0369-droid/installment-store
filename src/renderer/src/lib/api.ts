import { useAuthStore } from '../store/auth'

export interface IpcSuccess<T> {
  ok: true
  data: T
}
export interface IpcError {
  ok: false
  error: string
}
export type IpcResponse<T> = IpcSuccess<T> | IpcError

export async function call<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const token = useAuthStore.getState().token
  // For non-auth channels, prepend token if available
  let finalArgs = args
  if (!channel.startsWith('auth:login') && token && !args.includes(token)) {
    finalArgs = [token, ...args]
  }
  const response = (await window.api.invoke(channel, ...finalArgs)) as IpcResponse<T>
  if (!response || !response.ok) {
    const message = (response as IpcError | undefined)?.error ?? 'Unknown error'
    throw new Error(message)
  }
  return response.data
}

export async function callRaw<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const response = (await window.api.invoke(channel, ...args)) as IpcResponse<T>
  if (!response || !response.ok) {
    const message = (response as IpcError | undefined)?.error ?? 'Unknown error'
    throw new Error(message)
  }
  return response.data
}
