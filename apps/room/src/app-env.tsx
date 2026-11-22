import type { ClientPorts, LocalStore } from '@fpp/room-client'
import type { Language } from '@fpp/i18n'
import { createContext, useContext } from 'react'

/** What `fetch` returns of a response, as far as this app reads one. */
export type HttpResponse = { readonly status: number; json(): Promise<unknown> }

/**
 * Everything the app takes from its surroundings, parsed once where the page starts (`main.tsx`) and passed down
 * (docs/v9/ENGINEERING.md, Files and names): a test hands in the simulator's sockets and a fake clock instead.
 */
export type AppEnv = {
  /** The room client's ports: WebSocket, storage, timers, window signals, random, the address lookup. */
  readonly ports: ClientPorts
  readonly store: LocalStore
  /** `scheme://host[:port]` of the page: the socket and the API are on it (invariant 1). */
  readonly origin: string
  readonly fetch: (
    url: string,
    init?: {
      readonly method: string
      readonly headers?: Record<string, string>
      readonly body?: string
    },
  ) => Promise<HttpResponse>
  /** The address bar's fragment, without the `#`: where an invite link carries the password. */
  readonly hash: () => string
  /** Loads a language's catalogues and makes it the active one. */
  readonly activate: (language: Language) => Promise<void>
  /** A seed for a new seat's avatar. */
  readonly newAvatar: () => string
  readonly reload: () => void
}

const AppEnvContext = createContext<AppEnv | null>(null)

export const AppEnvProvider = AppEnvContext.Provider

export function useAppEnv(): AppEnv {
  const env = useContext(AppEnvContext)
  if (env === null) throw new Error('the app has no environment: wrap it in AppEnvProvider')
  return env
}
