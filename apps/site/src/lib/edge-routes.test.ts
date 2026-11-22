import { describe, expect, test } from 'bun:test'
import { bypassPatterns, routeChanges } from './edge-routes.ts'

const host = 'next.free-planning-poker.com'

describe('routeChanges', () => {
  test('creates every route with no Worker on an empty zone', () => {
    expect(routeChanges([], host)).toEqual([
      { action: 'create', pattern: 'next.free-planning-poker.com/room*' },
      { action: 'create', pattern: 'next.free-planning-poker.com/_room/*' },
      { action: 'create', pattern: 'next.free-planning-poker.com/api/*' },
    ])
  })

  test('changes nothing once they exist, and leaves the Worker route alone', () => {
    const existing = [
      { id: 'w', pattern: `${host}/*`, script: 'fpp-site-beta' },
      ...bypassPatterns(host).map((pattern, index) => ({
        id: String(index),
        pattern,
        script: null,
      })),
    ]
    expect(routeChanges(existing, host)).toEqual([])
  })

  test('detaches a Worker that sits on an API path', () => {
    const existing = [{ id: 'a', pattern: `${host}/api/*`, script: 'fpp-site-beta' }]
    expect(routeChanges(existing, host)).toContainEqual({
      action: 'detach',
      id: 'a',
      pattern: `${host}/api/*`,
      script: 'fpp-site-beta',
    })
  })
})
