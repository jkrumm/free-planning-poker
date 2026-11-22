/**
 * Every string the arena shows, in English and German (rule strings.md): the table's messages, which an entry
 * receives as `messages`, and the gallery's own labels. The room's message catalogue replaces this file's table part
 * once it exists (row v9-room-plain); until then it is the one place a word of the arena lives.
 */
import type { Card } from '@fpp/room-core/types'
import type { IntentType, Outcome, SeatStatus, TableMessages } from '@fpp/table/contract'

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

export type GalleryMessages = {
  readonly title: string
  readonly entry: string
  readonly compareWith: string
  readonly none: string
  readonly seats: string
  readonly phase: string
  readonly phaseName: (phase: string) => string
  readonly container: string
  readonly containerName: (id: string) => string
  readonly theme: string
  readonly light: string
  readonly dark: string
  readonly motion: string
  readonly motionFull: string
  readonly motionReduced: string
  readonly language: string
  readonly languageName: (language: Language) => string
  readonly play: string
  readonly pause: string
  readonly previous: string
  readonly nextFrame: string
  readonly frame: (input: { readonly index: number; readonly count: number }) => string
  readonly scorecard: string
  readonly direction: (input: { readonly direction: string; readonly author: string }) => string
  readonly lastIntent: (type: IntentType | null) => string
  readonly broken: (name: string) => string
  readonly noEntries: string
}

const plural = (locale: string) => new Intl.PluralRules(locale)

const enCard = (card: Card) =>
  card.label === '?' ? 'Abstain' : card.label === '☕' ? 'Break' : card.label
const deCard = (card: Card) =>
  card.label === '?' ? 'Enthaltung' : card.label === '☕' ? 'Pause' : card.label

const EN_STATUS: Readonly<Record<SeatStatus, string>> = {
  voted: 'voted',
  waiting: 'not voted yet',
  away: 'away',
  reconnecting: 'reconnecting',
  gone: 'left',
  spectator: 'watching',
  revealed: 'revealed',
}

const DE_STATUS: Readonly<Record<SeatStatus, string>> = {
  voted: 'hat gewählt',
  waiting: 'wählt noch',
  away: 'abwesend',
  reconnecting: 'verbindet neu',
  gone: 'gegangen',
  spectator: 'schaut zu',
  revealed: 'aufgedeckt',
}

const EN_OUTCOME: Readonly<Record<Outcome, (low: string, high: string) => string>> = {
  consensus: (low) => `Consensus on ${low}`,
  near: (low, high) => `Near consensus: ${low} to ${high}`,
  split: (low, high) => `Split: ${low} to ${high}`,
}

const DE_OUTCOME: Readonly<Record<Outcome, (low: string, high: string) => string>> = {
  consensus: (low) => `Einig bei ${low}`,
  near: (low, high) => `Fast einig: ${low} bis ${high}`,
  split: (low, high) => `Uneinig: ${low} bis ${high}`,
}

const REACTIONS = ['👍', '🎉', '🤔', '☕', '🔥']

const en: TableMessages = {
  locale: 'en',
  table: 'Planning poker table',
  seat: ({ name, self, status }) => `${name}${self ? ' (you)' : ''}, ${EN_STATUS[status]}`,
  status: (status) => EN_STATUS[status],
  card: enCard,
  cardBack: 'Face-down card',
  hand: 'Your cards',
  voteFor: ({ card, selected }) => `Vote ${enCard(card)}${selected ? ', selected' : ''}`,
  clear: 'Take back my vote',
  reveal: 'Reveal cards',
  cancel: 'Stop the countdown',
  revote: 'Vote again',
  next: 'Next topic',
  settle: (card) => `Settle on ${enCard(card)}`,
  react: ({ emoji, name }) => (name === null ? `Throw ${emoji}` : `Throw ${emoji} at ${name}`),
  reactions: REACTIONS,
  progress: ({ voted, players }) =>
    plural('en').select(players) === 'one'
      ? `${voted} of ${players} player voted`
      : `${voted} of ${players} players voted`,
  countdown: (seconds) =>
    plural('en').select(seconds) === 'one'
      ? `Revealing in ${seconds} second`
      : `Revealing in ${seconds} seconds`,
  outcome: ({ outcome, low, high }) => EN_OUTCOME[outcome](low, high),
  median: (value) => `Median ${value}`,
  mostCommon: (value) => `Most common ${value}`,
  average: (value) => `Average ${value}`,
  decided: (label) => `Decided: ${label}`,
  untitledTopic: 'Untitled topic',
  round: (no) => `Round ${no}`,
  spectators: (count) =>
    plural('en').select(count) === 'one' ? `${count} spectator` : `${count} spectators`,
  tally: ({ label, count }) => `${count} × ${label}`,
}

const de: TableMessages = {
  locale: 'de',
  table: 'Planning-Poker-Tisch',
  seat: ({ name, self, status }) => `${name}${self ? ' (du)' : ''}, ${DE_STATUS[status]}`,
  status: (status) => DE_STATUS[status],
  card: deCard,
  cardBack: 'Verdeckte Karte',
  hand: 'Deine Karten',
  voteFor: ({ card, selected }) => `${deCard(card)} wählen${selected ? ', gewählt' : ''}`,
  clear: 'Meine Stimme zurücknehmen',
  reveal: 'Karten aufdecken',
  cancel: 'Countdown anhalten',
  revote: 'Noch einmal schätzen',
  next: 'Nächstes Thema',
  settle: (card) => `Auf ${deCard(card)} festlegen`,
  react: ({ emoji, name }) => (name === null ? `${emoji} werfen` : `${emoji} auf ${name} werfen`),
  reactions: REACTIONS,
  progress: ({ voted, players }) =>
    plural('de').select(players) === 'one'
      ? `${voted} von ${players} Person hat gewählt`
      : `${voted} von ${players} Personen haben gewählt`,
  countdown: (seconds) =>
    plural('de').select(seconds) === 'one'
      ? `Aufdecken in ${seconds} Sekunde`
      : `Aufdecken in ${seconds} Sekunden`,
  outcome: ({ outcome, low, high }) => DE_OUTCOME[outcome](low, high),
  median: (value) => `Median ${value}`,
  mostCommon: (value) => `Am häufigsten ${value}`,
  average: (value) => `Durchschnitt ${value}`,
  decided: (label) => `Entschieden: ${label}`,
  untitledTopic: 'Thema ohne Titel',
  round: (no) => `Runde ${no}`,
  spectators: (count) =>
    plural('de').select(count) === 'one' ? `${count} schaut zu` : `${count} schauen zu`,
  tally: ({ label, count }) => `${count} × ${label}`,
}

export const TABLE_MESSAGES: Readonly<Record<Language, TableMessages>> = { en, de }

const EN_PHASES: Readonly<Record<string, string>> = {
  voting: 'Voting',
  countdown: 'Countdown',
  'unanimous-reveal': 'Unanimous reveal',
  'split-reveal': 'Split reveal',
  'second-vote': 'Second vote',
  settled: 'Settled',
}

const DE_PHASES: Readonly<Record<string, string>> = {
  voting: 'Abstimmung',
  countdown: 'Countdown',
  'unanimous-reveal': 'Einig aufgedeckt',
  'split-reveal': 'Uneinig aufgedeckt',
  'second-vote': 'Zweite Runde',
  settled: 'Festgelegt',
}

const EN_CONTAINERS: Readonly<Record<string, string>> = {
  phone: 'Phone, 360 × 640',
  laptop: 'Laptop, 1280 × 800',
  wall: 'Wall screen, 1920 × 1080',
}

const DE_CONTAINERS: Readonly<Record<string, string>> = {
  phone: 'Telefon, 360 × 640',
  laptop: 'Laptop, 1280 × 800',
  wall: 'Wandbildschirm, 1920 × 1080',
}

const EN_INTENTS: Readonly<Record<IntentType, string>> = {
  vote: 'vote',
  clear: 'clear',
  reveal: 'reveal',
  cancel: 'cancel',
  settle: 'settle',
  revote: 'vote again',
  next: 'next topic',
  react: 'react',
}

const DE_INTENTS: Readonly<Record<IntentType, string>> = {
  vote: 'wählen',
  clear: 'zurücknehmen',
  reveal: 'aufdecken',
  cancel: 'anhalten',
  settle: 'festlegen',
  revote: 'noch einmal',
  next: 'nächstes Thema',
  react: 'reagieren',
}

export const GALLERY_MESSAGES: Readonly<Record<Language, GalleryMessages>> = {
  en: {
    title: 'Table arena',
    entry: 'Entry',
    compareWith: 'Compare with',
    none: 'None',
    seats: 'Seats',
    phase: 'Phase',
    phaseName: (phase) => EN_PHASES[phase] ?? phase,
    container: 'Container',
    containerName: (id) => EN_CONTAINERS[id] ?? id,
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    motion: 'Motion',
    motionFull: 'Full',
    motionReduced: 'Reduced',
    language: 'Language',
    languageName: (language) => (language === 'en' ? 'English' : 'German'),
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous frame',
    nextFrame: 'Next frame',
    frame: ({ index, count }) => `Frame ${index + 1} of ${count}`,
    scorecard: 'Scorecard',
    direction: ({ direction, author }) => `${direction}, by ${author}`,
    lastIntent: (type) => (type === null ? 'No intent yet' : `Last intent: ${EN_INTENTS[type]}`),
    broken: (name) => `The entry ${name} failed to render this frame.`,
    noEntries: 'No entries under arena/entries.',
  },
  de: {
    title: 'Tisch-Arena',
    entry: 'Beitrag',
    compareWith: 'Vergleichen mit',
    none: 'Keiner',
    seats: 'Plätze',
    phase: 'Phase',
    phaseName: (phase) => DE_PHASES[phase] ?? phase,
    container: 'Fläche',
    containerName: (id) => DE_CONTAINERS[id] ?? id,
    theme: 'Farbschema',
    light: 'Hell',
    dark: 'Dunkel',
    motion: 'Bewegung',
    motionFull: 'Voll',
    motionReduced: 'Reduziert',
    language: 'Sprache',
    languageName: (language) => (language === 'en' ? 'Englisch' : 'Deutsch'),
    play: 'Abspielen',
    pause: 'Anhalten',
    previous: 'Vorheriges Bild',
    nextFrame: 'Nächstes Bild',
    frame: ({ index, count }) => `Bild ${index + 1} von ${count}`,
    scorecard: 'Auswertung',
    direction: ({ direction, author }) => `${direction}, von ${author}`,
    lastIntent: (type) =>
      type === null ? 'Noch keine Absicht' : `Letzte Absicht: ${DE_INTENTS[type]}`,
    broken: (name) => `Der Beitrag ${name} konnte dieses Bild nicht zeichnen.`,
    noEntries: 'Keine Beiträge unter arena/entries.',
  },
}
