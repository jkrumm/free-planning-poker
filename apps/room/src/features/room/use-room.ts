import {
  createRoomClient,
  type CommandResult,
  type RoomClient,
  type RoomClientState,
} from '@fpp/room-client'
import type { Command } from '@fpp/room-core/types'
import { useMemo, useSyncExternalStore } from 'react'
import { type AppEnv, useAppEnv } from '../../app-env.tsx'
import { createFunnel } from './funnel.ts'

/** How long after a reveal its decision is sent to Umami, so the funnel sees them in order. */
const DECISION_AFTER_REVEAL_MS = 300

const CONNECTING: RoomClientState = {
  status: 'connecting',
  view: null,
  seq: 0,
  pending: [],
  pendingVote: null,
  ownVote: null,
  closeCode: null,
  codeRefused: false,
  changedHands: null,
}

export type UseRoom = {
  readonly state: RoomClientState
  readonly send: (command: Command) => Promise<CommandResult>
  readonly submitCode: (code: string) => void
  readonly acceptNewRoom: () => void
  readonly rejoin: () => void
}

/** The password after `#`, written with `encodeURIComponent`; a broken escape is no password. */
function codeOf(fragment: string): string | undefined {
  if (fragment === '') return undefined
  try {
    return decodeURIComponent(fragment)
  } catch {
    return undefined
  }
}

/**
 * A room client that lives as long as somebody listens: the first subscriber opens it, the last one closes it. React
 * mounts, unmounts and mounts again in development; each round is one client, so no socket outlives its page.
 */
function roomStore(env: AppEnv, slug: string) {
  let client: RoomClient | null = null
  let listeners = 0
  let unwatch: (() => void) | null = null
  const funnel = createFunnel(
    (run) => void env.ports.timers.setTimeout(run, DECISION_AFTER_REVEAL_MS),
  )
  const open = (): RoomClient => {
    const code = codeOf(env.hash())
    return createRoomClient({
      slug,
      profile: () => env.store.profile.get() ?? { name: slug, avatar: env.newAvatar() },
      ports: env.ports,
      origin: env.origin,
      build: 'room',
      ...(code === undefined ? {} : { code }),
    })
  }
  return {
    subscribe: (listener: () => void) => {
      if (client === null) {
        const opened = open()
        client = opened
        unwatch = opened.state.subscribe(() => funnel.view(opened.state.getSnapshot().view))
        funnel.view(opened.state.getSnapshot().view)
      }
      listeners += 1
      const off = client.state.subscribe(listener)
      return () => {
        off()
        listeners -= 1
        if (listeners > 0) return
        unwatch?.()
        unwatch = null
        client?.dispose()
        client = null
      }
    },
    getSnapshot: (): RoomClientState => client?.state.getSnapshot() ?? CONNECTING,
    send: async (command: Command): Promise<CommandResult> => {
      if (client === null) return { ok: false, reason: 'offline' }
      const result = await client.send(command)
      funnel.command(command, result.ok)
      return result
    },
    submitCode: (code: string) => client?.submitCode(code),
    acceptNewRoom: () => client?.acceptNewRoom(),
    rejoin: () => client?.rejoin(),
  }
}

/** The one hook that binds `@fpp/room-client`: the seat's view, its connection, and the commands. */
export function useRoom(slug: string): UseRoom {
  const env = useAppEnv()
  const store = useMemo(() => roomStore(env, slug), [env, slug])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return {
    state,
    send: store.send,
    submitCode: store.submitCode,
    acceptNewRoom: store.acceptNewRoom,
    rejoin: store.rejoin,
  }
}
