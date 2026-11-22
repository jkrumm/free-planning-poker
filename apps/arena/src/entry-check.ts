/**
 * What makes a module under arena/entries an entry: an `entry` export with a component and a manifest whose name
 * is the directory's. Shared by the gallery and the render test.
 */
import type { Entry } from '@fpp/table/contract'

export type LoadedEntry = {
  readonly name: string
  readonly entry: Entry | null
  readonly problem: string | null
}

const NAME = /^[a-z0-9][a-z0-9-]*$/

export function checkEntry(name: string, candidate: unknown): LoadedEntry {
  if (typeof candidate !== 'object' || candidate === null)
    return { name, entry: null, problem: 'index.tsx exports no `entry`' }
  const { manifest, Table } = candidate as Partial<Entry>
  if (typeof Table !== 'function')
    return { name, entry: null, problem: '`entry.Table` is no component' }
  if (manifest === undefined || manifest.name !== name)
    return { name, entry: null, problem: `\`entry.manifest.name\` is not "${name}"` }
  if (!NAME.test(name))
    return { name, entry: null, problem: 'the directory name is not lowercase-dashed' }
  if (typeof manifest.direction !== 'string' || manifest.direction.trim() === '')
    return { name, entry: null, problem: 'the manifest names no direction' }
  return { name, entry: candidate as Entry, problem: null }
}
