/** UTC calendar arithmetic on `YYYY-MM-DD` days: no clock, no time zone, no Date outside this file. */

const MS_PER_DAY = 24 * 60 * 60 * 1000

const parse = (day: string): number => Date.parse(`${day}T00:00:00Z`)
const format = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export const addDays = (day: string, days: number): string => format(parse(day) + days * MS_PER_DAY)

/** ISO weekday: 1 Monday to 7 Sunday. */
export const isoWeekday = (day: string): number => new Date(parse(day)).getUTCDay() || 7

/** The Monday of the day's week. */
export const mondayOf = (day: string): string => addDays(day, 1 - isoWeekday(day))

/** Every day from `from` to `to`, both included; empty when `from` is after `to`. */
export function daysFrom(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

export type DayRange = { readonly from: string; readonly to: string }

/**
 * The two spans of the week-over-week comparison. Working days are Monday to Friday in UTC and no public holiday is
 * considered. The current week counts from its Monday to `today` (all five days from Saturday on), the previous week
 * the same number of days from its own Monday: on a Wednesday, Monday to Wednesday of both.
 */
export function workingWeeks(today: string): {
  readonly workingDays: number
  readonly current: DayRange
  readonly previous: DayRange
} {
  const workingDays = Math.min(isoWeekday(today), 5)
  const monday = mondayOf(today)
  const before = addDays(monday, -7)
  return {
    workingDays,
    current: { from: monday, to: addDays(monday, workingDays - 1) },
    previous: { from: before, to: addDays(before, workingDays - 1) },
  }
}
