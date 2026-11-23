/**
 * The room app against the real room runtime, in memory (docs/v9/ARCHITECTURE.md, Testing): the simulator's network and
 * clock stand in for the server, each seat is an app of its own in a DOM (happy-dom) with its own storage, and time
 * moves only when the test says so. A seat's app is what a browser tab runs; nothing in it is replaced but its ports.
 */
import type { ClientPorts, StorageLike } from '@fpp/room-client'
import { createLocalStore } from '@fpp/room-client'
import { createRoomRuntime, DEFAULT_SETTINGS, type RoomRuntime } from '@fpp/room-core/server'
import {
  checker,
  EPOCH,
  memoryHistory,
  memoryIds,
  memorySecrets,
  memoryStore,
  network,
  PROFILES,
  random,
  scheduler,
  telemetryRecorder,
  type Client,
} from '@fpp/room-core/sim'
import { parseAccessCode, parseSlug } from '@fpp/room-core/types'
import { I18nProvider } from '@lingui/react'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AppEnvProvider, type AppEnv } from '../src/app-env.tsx'
import { activatorOf, i18n, type Catalogues } from '../src/i18n.ts'
import { createAppRouter } from '../src/router.ts'

export const ADDRESS = '482913'
const ROOM = '1'
const LOCALES = resolve(import.meta.dirname, '../../../packages/i18n/locales')

/** The catalogue files of the package as lazy imports, as `import.meta.glob` hands them to the app. */
const catalogues: Catalogues = Object.fromEntries(
  readdirSync(LOCALES, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.po'))
    .map((name) => [name, () => import(join(LOCALES, name))]),
)

const memoryStorage = (): StorageLike => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
}

/** One room in the real runtime on a calm simulated network, and the clock that moves both. */
export function createWorld(options: { readonly code?: string; readonly slug?: string } = {}) {
  const rng = random(1)
  const clock = scheduler(EPOCH)
  const store = memoryStore()
  const telemetry = telemetryRecorder()
  store.rows.set(ROOM, {
    slug: parseSlug(options.slug ?? ADDRESS)!,
    name: 'Test room',
    access: options.code === undefined ? 'open' : 'locked',
    code: options.code === undefined ? null : parseAccessCode(options.code)!,
    settings: { ...DEFAULT_SETTINGS },
    accessEpoch: 0,
  })
  const check = checker({
    room: ROOM,
    now: clock.now,
    inspect: () => runtime?.inspect(ROOM),
    devices: () => [],
    codes: () => [],
    store,
    telemetry,
  })
  const net = network({
    clock,
    rng,
    profile: { ...PROFILES.calm },
    observer: check,
    trace: () => {},
  })
  const runtime: RoomRuntime = createRoomRuntime(
    {
      transport: net.transport,
      clock,
      ids: memoryIds(clock.now, rng.bits),
      secrets: memorySecrets,
      store,
      history: memoryHistory(),
      telemetry,
    },
    { build: 'test' },
  )
  net.bind(runtime)
  return {
    clock,
    net,
    /** Lets `ms` of simulated time pass, frames included, with React's updates flushed. */
    advance: (ms: number) =>
      act(async () => {
        await Promise.resolve()
        await clock.run(
          clock.now() + ms,
          () => {},
          () => false,
        )
      }),
  }
}

export type World = ReturnType<typeof createWorld>

/** A WebSocket whose other end is the world's network. */
function socketsOf(world: World, ip: string): ClientPorts['WebSocket'] {
  return function (this: unknown) {
    const socket = {
      onopen: null as ((event: unknown) => void) | null,
      onmessage: null as ((event: { data: unknown }) => void) | null,
      onclose: null as ((event: { code: number }) => void) | null,
      onerror: null as ((event: unknown) => void) | null,
      send: (data: string) => world.net.send(link, JSON.parse(data) as object),
      close: (code?: number) => {
        world.net.hangUp(link, false)
        queueMicrotask(() => socket.onclose?.({ code: code ?? 1005 }))
      },
    }
    const client: Client = {
      frame: (frame) => socket.onmessage?.({ data: JSON.stringify(frame) }),
      close: (code) => socket.onclose?.({ code }),
    }
    const link = world.net.connect(client, { room: ROOM, ip })
    queueMicrotask(() => socket.onopen?.({}))
    return socket
  } as unknown as ClientPorts['WebSocket']
}

export type Seat = {
  readonly container: HTMLElement
  readonly env: AppEnv
  /** The fetch calls the app made, in order. */
  readonly requests: {
    readonly url: string
    readonly method: string
    readonly headers: Record<string, string>
    readonly body: unknown
  }[]
  /** The element with this `data-testid`; throws when there is none. */
  readonly byId: (id: string) => HTMLElement
  readonly allById: (id: string) => HTMLElement[]
  readonly maybeById: (id: string) => HTMLElement | null
  readonly text: () => string
  readonly click: (element: Element) => Promise<void>
  readonly type: (element: Element, value: string) => Promise<void>
  readonly choose: (element: Element, value: string) => Promise<void>
  /** Submits the form an element is in, as pressing Enter does. */
  readonly submit: (element: Element) => Promise<void>
  readonly navigate: (path: string) => Promise<void>
  readonly unmount: () => Promise<void>
}

/** One browser tab: an app of its own at `path`, with its own storage, on the world's network. */
export async function openSeat(
  world: World,
  options: {
    readonly path: string
    readonly ip: string
    readonly profile?: string
    readonly hash?: string
    readonly fetch?: AppEnv['fetch']
  },
): Promise<Seat> {
  const storage = memoryStorage()
  const timers = {
    now: world.clock.now,
    setTimeout: (run: () => void, ms: number) => world.clock.schedule(world.clock.now() + ms, run),
    clearTimeout: world.clock.cancel,
  }
  const randomFloat = random(Math.floor(world.clock.now()) + options.ip.length).next
  const ports: ClientPorts = {
    WebSocket: socketsOf(world, options.ip),
    storage,
    timers,
    signals: { onOnline: () => () => {}, onVisible: () => () => {} },
    random: randomFloat,
  }
  const store = createLocalStore({ storage, now: world.clock.now, random: randomFloat })
  if (options.profile !== undefined) store.profile.set({ name: options.profile, avatar: 'seed' })
  const requests: Seat['requests'] = []
  const activator = activatorOf(catalogues)
  /** Language switches the app started and the test has not yet awaited. */
  const activations: Promise<void>[] = []
  const env: AppEnv = {
    ports,
    store,
    origin: 'http://test.local',
    fetch:
      options.fetch === undefined
        ? async () => ({ status: 500, json: async () => ({}) })
        : async (url, init) => {
            requests.push({
              url,
              method: init?.method ?? 'GET',
              headers: init?.headers ?? {},
              body: init?.body === undefined ? undefined : JSON.parse(init.body),
            })
            return options.fetch!(url, init)
          },
    hash: () => options.hash ?? '',
    activate: (language) => {
      const done = activator(language)
      activations.push(done)
      return done
    },
    newAvatar: () => 'seed',
    reload: () => {},
  }
  await act(async () => env.activate('en'))
  const history = createMemoryHistory({ initialEntries: [options.path] })
  const router = createAppRouter(history)
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  await act(async () => {
    root.render(
      <AppEnvProvider value={env}>
        <I18nProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nProvider>
      </AppEnvProvider>,
    )
  })
  await world.advance(500)

  const byId = (id: string): HTMLElement => {
    const found = container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (found === null) throw new Error(`no element ${id} in: ${container.textContent}`)
    return found
  }
  return {
    container,
    env,
    requests,
    byId,
    allById: (id) => [...container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)],
    maybeById: (id) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`),
    text: () => container.textContent ?? '',
    click: async (element) => {
      await act(async () => (element as HTMLElement).click())
      await world.advance(500)
    },
    type: async (element, value) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement
      const prototype = Object.getPrototypeOf(input) as object
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    },
    choose: async (element, value) => {
      const select = element as HTMLSelectElement
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(
          select,
          value,
        )
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await Promise.all(activations.splice(0))
      })
      await world.advance(500)
    },
    submit: async (element) => {
      const form = element.closest('form')
      if (form === null) throw new Error('the element is in no form')
      await act(async () =>
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
      )
      await world.advance(500)
    },
    navigate: async (path) => {
      await act(async () => router.navigate({ to: path }))
      await world.advance(500)
    },
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}
