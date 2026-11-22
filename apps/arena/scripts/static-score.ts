/**
 * The scorecard's checks that need no browser, for one entry: the gzip size of its own code and of what it adds to
 * the room's bundle, colour literals in its source, and that it stays inside its directory. Writes
 * arena/scores/<entry>/static.json, which the Playwright run (e2e/arena) turns into floor results.
 *
 *   bun apps/arena/scripts/static-score.ts <entry>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import react from '@vitejs/plugin-react'
import { build, type Rollup } from 'vite'

const root = resolve(import.meta.dir, '../../..')
const name = Bun.argv[2]
if (name === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('usage: bun apps/arena/scripts/static-score.ts <entry>')
  process.exit(2)
}
const dir = join(root, 'arena/entries', name)
const index = join(dir, 'index.tsx')
if (!(await Bun.file(index).exists())) {
  console.error(`no entry at ${relative(root, index)}`)
  process.exit(2)
}

/** What the room already ships, so an entry's use of it costs nothing extra. */
const ROOM_PROVIDES = /^(react|react-dom)(\/|$)/
const isBare = (id: string) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')

/** Builds the entry as a library, with `external` deciding what is left out, and returns the gzip bytes of the rest. */
async function gzipBytes(
  external: (id: string) => boolean,
): Promise<{ bytes: number; files: string[] }> {
  const output = (await build({
    configFile: false,
    logLevel: 'silent',
    root: dir,
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom'] },
    build: {
      write: false,
      minify: true,
      cssCodeSplit: false,
      lib: { entry: index, formats: ['es'], fileName: 'entry' },
      rolldownOptions: { external },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[]
  const chunks = (Array.isArray(output) ? output : [output]).flatMap((result) => result.output)
  let bytes = 0
  const files: string[] = []
  for (const chunk of chunks) {
    const source = chunk.type === 'chunk' ? chunk.code : chunk.source
    bytes += gzipSync(typeof source === 'string' ? Buffer.from(source) : Buffer.from(source)).length
    files.push(chunk.fileName)
  }
  return { bytes, files }
}

const own = await gzipBytes((id) => isBare(id))
const adds = await gzipBytes((id) => ROOM_PROVIDES.test(id))

// Colour literals: hex, the colour functions and the named colours, outside comments.
const NAMED =
  'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen'
const COLOUR_PATTERNS: readonly [RegExp, string][] = [
  [/#[0-9a-fA-F]{3,8}\b/g, 'hex colour'],
  [/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g, 'colour function'],
  // A named colour as a CSS value (after a colon) or as a whole string literal.
  [new RegExp(`:\\s*(${NAMED})\\b|['"\`](${NAMED})['"\`]`, 'gi'), 'named colour'],
]

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

const SOURCE = /\.(tsx?|css|svg|html)$/
const files = [...new Bun.Glob('**/*').scanSync({ cwd: dir })]
  .filter((file) => SOURCE.test(file))
  .toSorted()
const colours: { file: string; line: number; text: string; kind: string }[] = []
const leaks: { file: string; line: number; specifier: string; why: string }[] = []

/** Imports an entry may not make: the room's transport and server code, and anything outside its own directory. */
const FORBIDDEN =
  /^@fpp\/(room-client|telemetry|api|room|site|arena|e2e)(\/|$)|^@fpp\/room-core\/(server|sim|protocol)$/

for (const file of files) {
  const source = stripComments(readFileSync(join(dir, file), 'utf8'))
  const lines = source.split('\n')
  lines.forEach((text, number) => {
    for (const [pattern, kind] of COLOUR_PATTERNS) {
      // A hex-looking token inside an id or a url is still a colour to a browser only in CSS; keep it simple and strict.
      for (const match of text.matchAll(pattern))
        colours.push({ file, line: number + 1, text: match[0], kind })
    }
  })
  if (!/\.(tsx?)$/.test(file)) continue
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1]!
    const line = source.slice(0, match.index).split('\n').length
    if (specifier.startsWith('.')) {
      const target = resolve(dirname(join(dir, file)), specifier)
      if (!target.startsWith(dir))
        leaks.push({ file, line, specifier, why: 'reaches outside the entry directory' })
    } else if (FORBIDDEN.test(specifier))
      leaks.push({ file, line, specifier, why: 'not part of the table contract' })
  }
}

const result = {
  entry: name,
  size: { ownGzip: own.bytes, addsGzip: adds.bytes, ownFiles: own.files },
  colours,
  leaks,
}
const out = join(root, 'arena/scores', name)
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'static.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(
  `${name}: own code ${(own.bytes / 1024).toFixed(1)} kB gzip, adds ${(adds.bytes / 1024).toFixed(1)} kB gzip, ` +
    `${colours.length} colour literal(s), ${leaks.length} import(s) outside the contract`,
)
