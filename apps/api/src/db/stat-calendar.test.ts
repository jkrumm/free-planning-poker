import { expect, test } from 'bun:test'
import { addDays, daysFrom, isoWeekday, mondayOf, workingWeeks } from './stat-calendar.ts'

// 2026-11-16 is a Monday.
test('weekdays and Mondays', () => {
  expect(isoWeekday('2026-11-16')).toBe(1)
  expect(isoWeekday('2026-11-22')).toBe(7)
  expect(mondayOf('2026-11-22')).toBe('2026-11-16')
  expect(mondayOf('2026-11-16')).toBe('2026-11-16')
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(daysFrom('2026-02-27', '2026-03-02')).toEqual([
    '2026-02-27',
    '2026-02-28',
    '2026-03-01',
    '2026-03-02',
  ])
  expect(daysFrom('2026-03-02', '2026-03-01')).toEqual([])
})

test('on a Wednesday the comparison spans Monday to Wednesday of both weeks', () => {
  expect(workingWeeks('2026-11-18')).toEqual({
    workingDays: 3,
    current: { from: '2026-11-16', to: '2026-11-18' },
    previous: { from: '2026-11-09', to: '2026-11-11' },
  })
})

test('on a Monday it is one day of each', () => {
  expect(workingWeeks('2026-11-16')).toEqual({
    workingDays: 1,
    current: { from: '2026-11-16', to: '2026-11-16' },
    previous: { from: '2026-11-09', to: '2026-11-09' },
  })
})

test('from Friday on the whole working week is compared, a weekend included', () => {
  for (const today of ['2026-11-20', '2026-11-21', '2026-11-22']) {
    expect(workingWeeks(today)).toEqual({
      workingDays: 5,
      current: { from: '2026-11-16', to: '2026-11-20' },
      previous: { from: '2026-11-09', to: '2026-11-13' },
    })
  }
})

test('a week across a year boundary', () => {
  expect(workingWeeks('2027-01-01').previous).toEqual({ from: '2026-12-21', to: '2026-12-25' })
})
