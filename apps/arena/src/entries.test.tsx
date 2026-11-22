/**
 * Every entry under arena/entries renders every frame of every scenario without throwing, through the same
 * `checkEntry` the gallery uses. A server render: no browser, so it runs in `make check-fast`; the scorecard
 * (`make arena-score`) judges the rest in Chromium.
 */
import { describe, expect, test } from 'bun:test'
import { dirname, join, resolve } from 'node:path'
import { renderToString } from 'react-dom/server'
import { SCENARIOS } from '@fpp/table/scenarios'
import { checkEntry } from './entry-check.ts'
import { effectsAt, framesOf } from './frames.ts'
import { TABLE_MESSAGES } from './messages.ts'

const root = resolve(import.meta.dir, '../../..')
const paths = [...new Bun.Glob('arena/entries/*/index.tsx').scanSync({ cwd: root })].toSorted()

describe('arena entries', () => {
  test('the reference entry is there', () => {
    expect(paths).toContain('arena/entries/reference/index.tsx')
  })

  for (const path of paths) {
    const name = dirname(path).split('/').at(-1) ?? path
    test(`${name} exports a well-formed entry and renders every frame of every scenario`, async () => {
      const loaded = checkEntry(
        name,
        ((await import(join(root, path))) as { entry?: unknown }).entry,
      )
      expect(loaded.problem).toBeNull()
      const Table = loaded.entry!.Table
      for (const scenario of SCENARIOS) {
        const frames = framesOf(scenario)
        frames.forEach((frame, index) => {
          const html = renderToString(
            <Table
              view={frame.view}
              now={frame.now}
              size={{ width: 1280, height: 800 }}
              preferences={{ calm: false, reducedMotion: false, sound: false, theme: 'light' }}
              messages={TABLE_MESSAGES.en}
              onIntent={() => undefined}
              effects={effectsAt(frames, index)}
            />,
          )
          expect(html.length).toBeGreaterThan(0)
        })
      }
    })
  }
})
