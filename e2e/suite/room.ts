/**
 * What every test of the suite shares: a fixture `room` that opens one browser context per seat, helpers that read a
 * seat's page by the ids of e2e/TESTIDS.md, and the capture of every WebSocket frame a seat received. A test makes its
 * own room, and every context is closed when the test ends (rules/browser.md: a context left open keeps its pages).
 */
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test'

export { expect }

export type Seat = {
  readonly name: string
  readonly context: BrowserContext
  readonly page: Page
  /** Every frame this page received on any WebSocket, in order, as text. */
  readonly frames: string[]
}

export type RoomOptions = {
  /** The stack the seats open; the suite's own by default. */
  readonly baseURL?: string
  readonly contextOptions?: BrowserContextOptions
  /** Seat names; the default is "Seat 1", "Seat 2", ... */
  readonly names?: readonly string[]
}

export type Room = {
  readonly slug: string
  readonly seats: readonly Seat[]
  /** One more seat on this room: a new context, a name, a seat. `url` is the address it opens (an invite link). */
  join(
    name: string,
    options?: { readonly url?: string; readonly contextOptions?: BrowserContextOptions },
  ): Promise<Seat>
  /** A context that has opened the room's address and been asked for its name, but has not taken a seat. */
  visit(url: string): Promise<Seat>
}

type Fixtures = {
  room: (count: number, options?: RoomOptions) => Promise<Room>
}

const BASE = process.env['E2E_BASE_URL'] ?? ''

async function newSeat(
  browser: Browser,
  opened: BrowserContext[],
  name: string,
  baseURL: string,
  contextOptions: BrowserContextOptions | undefined,
): Promise<Seat> {
  const context = await browser.newContext({ baseURL, ...contextOptions })
  opened.push(context)
  const page = await context.newPage()
  const frames: string[] = []
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      frames.push(
        typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8'),
      )
    })
  })
  return { name, context, page, frames }
}

const take = async (seat: Seat) => {
  await seat.page.getByTestId('name-input').fill(seat.name)
  await seat.page.getByTestId('join-room').click()
  await expect(seat.page.getByTestId('status')).toHaveAttribute('data-status', 'live')
}

export const test = base.extend<Fixtures>({
  room: async ({ browser }, provide) => {
    const opened: BrowserContext[] = []
    await provide(async (count, options = {}) => {
      const { contextOptions, names, baseURL = BASE } = options
      const nameOf = (index: number) => names?.[index] ?? `Seat ${index + 1}`
      const first = await newSeat(browser, opened, nameOf(0), baseURL, contextOptions)
      // The first seat creates the room the way a person does: /room/new, which replaces itself with the room's address.
      await first.page.goto('/room/new')
      await first.page.waitForURL(
        (url) => /^\/room\/[^/]+$/.test(url.pathname) && url.pathname !== '/room/new',
      )
      const slug = new URL(first.page.url()).pathname.split('/').pop() ?? ''
      await take(first)
      const seats: Seat[] = [first]
      const join: Room['join'] = async (name, joinOptions = {}) => {
        const seat = await newSeat(
          browser,
          opened,
          name,
          baseURL,
          joinOptions.contextOptions ?? contextOptions,
        )
        await seat.page.goto(joinOptions.url ?? `/room/${slug}`)
        await take(seat)
        return seat
      }
      const visit: Room['visit'] = async (url) => {
        const seat = await newSeat(browser, opened, 'Visitor', baseURL, contextOptions)
        await seat.page.goto(url)
        return seat
      }
      const rest = await Promise.all(
        Array.from({ length: count - 1 }, (_, index) => join(nameOf(index + 1))),
      )
      seats.push(...rest)
      // Everybody sees everybody before the test starts.
      for (const seat of seats) await expect(seatRows(seat.page)).toHaveCount(count)
      return { slug, seats, join, visit }
    })
    await Promise.all(opened.map((context) => context.close()))
  },
})

/** The seats of the table, as one page shows them. */
const seatRows = (page: Page): Locator => page.getByTestId('seat')

/** The row of the seat named `name` on this page. */
export const seatOf = (page: Page, name: string): Locator =>
  seatRows(page).filter({ has: page.getByTestId('seat-name').getByText(name, { exact: true }) })

/** The row of the seat this page belongs to. */
export const ownSeat = (page: Page): Locator => page.locator('[data-testid=seat][data-self=true]')

/** A card of the hand, by its label. */
export const card = (page: Page, label: string): Locator =>
  page.locator(`[data-testid=card][data-card="${label}"]`)

export const round = (page: Page): Locator => page.getByTestId('round')

export const vote = async (seat: Seat, label: string, how: { readonly tap?: boolean } = {}) => {
  if (how.tap === true) await card(seat.page, label).tap()
  else await card(seat.page, label).click()
  await expect(card(seat.page, label)).toHaveAttribute('aria-pressed', 'true')
}

/** Every card is down: the round of this page is revealed. */
export const expectRevealed = (page: Page) =>
  expect(round(page)).toHaveAttribute('data-state', 'revealed')

/** The round is open for votes. */
export const expectVoting = (page: Page) =>
  expect(round(page)).toHaveAttribute('data-state', 'voting')

/** Every seat's page shows the same, whatever it is: run the assertion on each. */
export const everyone = async (seats: readonly Seat[], check: (seat: Seat) => Promise<void>) => {
  await Promise.all(seats.map(check))
}

/** Reads the leaves of a frame's JSON, without a `deck` (the deck lists every card by design) and without counters. */
function leaves(value: unknown, key = ''): string[] {
  if (key === 'deck' || key === 'seq') return []
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => leaves(item, key))
  if (value !== null && typeof value === 'object')
    return Object.entries(value).flatMap(([name, item]) => leaves(item, name))
  return []
}

/** The values of `values` that appear as a leaf of a received frame outside a deck. */
export function leakedIn(frames: readonly string[], values: readonly string[]): string[] {
  const found = new Set<string>()
  for (const text of frames) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      // A frame that is no JSON cannot carry a value the protocol defines; the next assertion on the page shows it.
      continue
    }
    for (const leaf of leaves(parsed)) if (values.includes(leaf)) found.add(leaf)
  }
  return [...found]
}

/**
 * The page's markup without its hand (the cards of the deck are in it by design), as text, for a search of values.
 * Runs in the page.
 */
export const markupWithoutHand = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement
    for (const hand of copy.querySelectorAll('[data-testid=deck]')) hand.remove()
    for (const select of copy.querySelectorAll('select')) select.remove()
    return copy.outerHTML
  })

/** The values of `values` that appear in `markup` as a token of their own. */
export const valuesIn = (markup: string, values: readonly string[]): string[] =>
  values.filter((value) => new RegExp(`(?<![\\w.-])${value}(?![\\w.-])`).test(markup))
