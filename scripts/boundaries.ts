#!/usr/bin/env bun
/**
 * The repo map's arrows and the module classes, checked on every source file of the workspace. The table is the root
 * `boundaries.toml`; docs/v9/ENGINEERING.md (What a script enforces) has the rules. Run by `make check-fast`; exits 1
 * on a violation.
 */
import { readdir, readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'

export type Violation = { file: string; rule: string; detail: string }

type Module = {
  path: string
  package: string
  imports: string[]
  types: string[]
  testsOnly: boolean
  exports: Set<string>
}

type ClassName = 'shell' | 'pure' | 'adapter'
const CLASS_ORDER: readonly ClassName[] = ['shell', 'pure', 'adapter']

type Table = { modules: Module[]; classes: Record<ClassName, string[]> }

type Import = { specifier: string; typeOnly: boolean }

/** Where Effect may be imported (docs/v9/ARCHITECTURE.md, Repo map). */
const EFFECT_ALLOWED = ['apps/api/src/app/', 'apps/api/src/db/', 'apps/api/src/jobs/']
const EFFECT = /^(effect|@effect\/[^/]+)(\/|$)/
const EFFECT_UNSTABLE = /^effect\/unstable(\/|$)/

/** Where Elysia, a pinned release candidate, may be imported (docs/v9/ARCHITECTURE.md, Server). */
const ELYSIA_ALLOWED = ['apps/api/src/http/', 'apps/api/src/ws/']
const ELYSIA = /^(elysia|@elysia\/[^/]+)(\/|$)/

const NODE_BUILTINS = new Set(builtinModules)
const isIoModule = (specifier: string) =>
  specifier === 'bun' ||
  specifier.startsWith('bun:') ||
  specifier.startsWith('node:') ||
  NODE_BUILTINS.has(specifier.split('/')[0] ?? '')

/** Globals a pure module may not touch: I/O, timers, the clock, chance, the process. */
const PURE_FORBIDDEN_GLOBALS: readonly [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch'],
  [/\bWebSocket\b/, 'WebSocket'],
  [
    /\b(setTimeout|setInterval|setImmediate|clearTimeout|clearInterval|clearImmediate)\b/,
    'a timer function',
  ],
  [/\bDate\.now\b/, 'Date.now'],
  [/\bnew\s+Date\s*\(\s*\)/, 'new Date()'],
  [/\bperformance\.now\b/, 'performance.now'],
  [/\bMath\.random\b/, 'Math.random'],
  [/\bcrypto\.(randomUUID|getRandomValues)\b/, 'crypto randomness'],
  [/\bprocess\./, 'process'],
  [/\bBun\./, 'Bun'],
]

const ENV_READ = /\b(process\.env|Bun\.env|import\.meta\.env)\b/

const SOURCE = /\.(ts|tsx|mts|cts)$/
const TEST = /\.(test|spec|e2e)\.(ts|tsx)$/

const posix = (path: string) => path.split(sep).join('/')

/** Blanks comments, keeping line breaks. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/** Blanks string and template literals, so a word in a message is no global. */
function stripStrings(code: string): string {
  return code.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''")
}

export function importsOf(source: string): Import[] {
  const code = stripComments(source)
  const found: Import[] = []
  const statement =
    /(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/g
  for (const match of code.matchAll(statement)) {
    const specifier = match[4]
    if (!specifier) continue
    const clause = match[3] ?? ''
    const named = /^\{([^}]*)\}$/.exec(clause.trim())?.[1]
    const inlineTypes =
      named !== undefined &&
      named.trim() !== '' &&
      named
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .every((part) => part.startsWith('type '))
    found.push({ specifier, typeOnly: Boolean(match[2]) || inlineTypes })
  }
  const dynamic = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of code.matchAll(dynamic)) {
    const specifier = match[1] ?? match[2]
    if (specifier) found.push({ specifier, typeOnly: false })
  }
  return found
}

async function readTable(root: string): Promise<Table> {
  const raw = Bun.TOML.parse(await readFile(join(root, 'boundaries.toml'), 'utf8')) as {
    module?: {
      path: string
      package: string
      imports?: string[]
      types?: string[]
      tests_only?: boolean
    }[]
    classes?: Partial<Record<ClassName, string[]>>
  }
  const modules = await Promise.all(
    (raw.module ?? []).map(async (entry) => {
      const manifest = await readFile(join(root, entry.path, 'package.json'), 'utf8')
        .then((text) => JSON.parse(text) as { exports?: unknown })
        .catch(() => undefined)
      const exportsField = manifest?.exports
      const exports = new Set(
        typeof exportsField === 'object' && exportsField !== null
          ? Object.keys(exportsField)
          : exportsField === undefined
            ? []
            : ['.'],
      )
      return {
        path: entry.path,
        package: entry.package,
        imports: entry.imports ?? [],
        types: entry.types ?? [],
        testsOnly: entry.tests_only ?? false,
        exports,
      }
    }),
  )
  return {
    modules,
    classes: {
      shell: raw.classes?.shell ?? [],
      pure: raw.classes?.pure ?? [],
      adapter: raw.classes?.adapter ?? [],
    },
  }
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        return ['node_modules', 'dist', '.astro'].includes(entry.name) ? [] : sourceFiles(path)
      }
      return SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
    }),
  )
  return nested.flat()
}

/** The module directories that exist: every directory under apps/ and packages/, and e2e/ and arena/. */
async function moduleDirs(root: string): Promise<string[]> {
  const dirs: string[] = []
  for (const parent of ['apps', 'packages']) {
    const entries = await readdir(join(root, parent), { withFileTypes: true }).catch(() => [])
    for (const entry of entries) if (entry.isDirectory()) dirs.push(`${parent}/${entry.name}`)
  }
  for (const single of ['e2e', 'arena']) {
    const entries = await readdir(join(root, single)).catch(() => undefined)
    if (entries) dirs.push(single)
  }
  return dirs
}

const moduleOf = (modules: Module[], rel: string) =>
  modules.find((module) => rel === module.path || rel.startsWith(`${module.path}/`))

function classOf(table: Table, rel: string): ClassName | undefined {
  return CLASS_ORDER.find((name) =>
    table.classes[name].some((glob) => new Bun.Glob(glob).match(rel)),
  )
}

/** Every violation in the workspace under `root`, sorted by file. */
export async function checkBoundaries(root: string): Promise<Violation[]> {
  const table = await readTable(root)
  const violations: Violation[] = []
  const byPackage = new Map(table.modules.map((module) => [module.package, module]))

  for (const dir of await moduleDirs(root)) {
    if (!table.modules.some((module) => module.path === dir)) {
      violations.push({ file: dir, rule: 'every module is listed in boundaries.toml', detail: dir })
    }
  }

  const files: string[] = []
  for (const dir of await moduleDirs(root)) files.push(...(await sourceFiles(join(root, dir))))

  for (const file of files.toSorted()) {
    const rel = posix(relative(root, file))
    const here = moduleOf(table.modules, rel)
    if (!here) continue
    const isTest = TEST.test(rel)
    const cls = isTest ? undefined : classOf(table, rel)
    const source = await readFile(file, 'utf8')
    const flag = (rule: string, detail: string) => violations.push({ file: rel, rule, detail })

    for (const { specifier, typeOnly } of importsOf(source)) {
      if (specifier.startsWith('.')) {
        const target = posix(relative(root, resolve(dirname(file), specifier)))
        const there = moduleOf(table.modules, target)
        if (there !== here) {
          flag('a module reaches another only by its package name', specifier)
        } else if (
          cls === 'pure' &&
          !TEST.test(target) &&
          classOf(table, withSource(target)) !== 'pure'
        ) {
          flag('a pure module imports only pure modules', specifier)
        }
        continue
      }

      if (EFFECT_UNSTABLE.test(specifier)) {
        flag('nothing is imported from effect/unstable', specifier)
      } else if (
        EFFECT.test(specifier) &&
        !EFFECT_ALLOWED.some((prefix) => rel.startsWith(prefix))
      ) {
        flag('effect is imported in apps/api/src/app, src/db and src/jobs only', specifier)
      }
      if (ELYSIA.test(specifier) && !ELYSIA_ALLOWED.some((prefix) => rel.startsWith(prefix))) {
        flag('elysia is imported in apps/api/src/http and src/ws only', specifier)
      }

      if (cls === 'pure' && isIoModule(specifier)) {
        flag('a pure module does no I/O: no node:*, bun or bun:*', specifier)
      }

      const workspace = /^(@fpp\/[^/]+)(\/.*)?$/.exec(specifier)
      if (!workspace?.[1]) continue
      const name = workspace[1]
      const there = byPackage.get(name)
      if (!there) {
        flag('a workspace import names a module of boundaries.toml', specifier)
        continue
      }
      if (there === here) continue
      if (there.testsOnly) {
        if (!isTest) flag(`${name} is imported by test files only`, specifier)
      } else if (!(here.imports.includes(name) || (typeOnly && here.types.includes(name)))) {
        const rule = here.types.includes(name)
          ? `${here.package} imports only types from ${name}`
          : `${here.package} may not import ${name} (boundaries.toml)`
        flag(rule, specifier)
      }
      const subpath = `.${workspace[2] ?? ''}`
      if (!there.exports.has(subpath)) {
        flag(`an import stays inside ${name}'s exports map`, specifier)
      }
    }

    if (cls === 'pure') {
      const code = stripStrings(stripComments(source))
      for (const [pattern, name] of PURE_FORBIDDEN_GLOBALS) {
        if (pattern.test(code)) flag('a pure module does no I/O and reads no clock or chance', name)
      }
    }
    if (cls === 'adapter') {
      const read = ENV_READ.exec(stripStrings(stripComments(source)))
      if (read)
        flag("an adapter reads no environment: values come from the app's entry file", read[0])
    }
  }
  return violations
}

/** A relative import names a file without its extension, or with `.ts`; the class globs match the file. */
function withSource(target: string): string {
  return SOURCE.test(target) ? target : `${target}.ts`
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const violations = await checkBoundaries(root)
  for (const v of violations) console.error(`${v.file}: ${v.rule} (${v.detail})`)
  if (violations.length > 0) {
    console.error(
      `${violations.length} boundary violation(s); boundaries.toml and docs/v9/ENGINEERING.md (What a script enforces) have the rules`,
    )
    process.exit(1)
  }
  console.log('boundaries hold')
}
