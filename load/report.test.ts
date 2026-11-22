import { expect, test } from 'bun:test'
import {
  mebibytes,
  parseStatsLine,
  peakUpgrades,
  serviceOf,
  upgradesBySecond,
  usageOf,
} from './report.ts'

test('sizes become mebibytes, whatever unit docker stats chose', () => {
  expect(mebibytes('123.5MiB')).toBe(123.5)
  expect(mebibytes('1.5GiB')).toBe(1536)
  expect(mebibytes('1024kB')).toBe(1)
  expect(mebibytes('nothing')).toBeNaN()
})

test('a container name maps to its service, a compose run container included', () => {
  expect(serviceOf('fpp-load-ab12-api-1', 'fpp-load-ab12')).toBe('api')
  expect(serviceOf('fpp-load-ab12-api-next-1', 'fpp-load-ab12')).toBe('api-next')
  expect(serviceOf('fpp-load-ab12-k6-run-3f2a9c', 'fpp-load-ab12')).toBe('k6')
})

test('a stats line becomes a sample, and one without a reading is skipped', () => {
  const line = JSON.stringify({
    Name: 'p-api-1',
    CPUPerc: '87.25%',
    MemUsage: '210.4MiB / 512MiB',
  })
  expect(parseStatsLine(line, 'p', 7)).toEqual({
    at: 7,
    service: 'api',
    cpuPercent: 87.25,
    memMiB: 210.4,
  })
  expect(
    parseStatsLine(JSON.stringify({ Name: 'p-api-1', CPUPerc: '--', MemUsage: '-- / --' }), 'p', 7),
  ).toBeUndefined()
  expect(parseStatsLine('not json', 'p', 7)).toBeUndefined()
})

test('use of a service is its peak and mean', () => {
  const samples = [10, 30, 20].map((cpuPercent, index) => ({
    at: index,
    service: 'api',
    cpuPercent,
    memMiB: 100 + index * 50,
  }))
  expect(usageOf(samples)['api']).toEqual({
    samples: 3,
    peakCpuPercent: 30,
    meanCpuPercent: 20,
    peakMemMiB: 200,
  })
})

test('upgrades of several users add up per second and the peak is read inside a window', () => {
  const total = upgradesBySecond([
    { bySecond: { '3': 2, '95': 40 } },
    { bySecond: { '95': 60, '96': 10 } },
  ])
  expect(total.get(95)).toBe(100)
  expect(peakUpgrades(total)).toEqual({ perSecond: 100, second: 95 })
  expect(peakUpgrades(total, { from: 0, to: 50 })).toEqual({ perSecond: 2, second: 3 })
})
