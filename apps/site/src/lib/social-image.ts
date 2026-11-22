import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { socialImageSize } from './social.ts'

// Inter (OFL), the Latin subset of @fontsource/inter in two weights. satori reads TrueType, OpenType and WOFF, not WOFF2.
// Resolved through require: import.meta.resolve is not available while Vite loads astro.config.ts, which imports this.
const fontDir = join(
  dirname(createRequire(import.meta.url).resolve('@fontsource/inter/package.json')),
  'files',
)
const font = (file: string) => readFileSync(join(fontDir, file))
const fonts = [
  {
    name: 'Inter',
    data: font('inter-latin-400-normal.woff'),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'Inter',
    data: font('inter-latin-700-normal.woff'),
    weight: 700 as const,
    style: 'normal' as const,
  },
]

const padding = 72
const contentWidth = socialImageSize.width - 2 * padding

type Node = {
  type: string
  props: { style?: Record<string, string | number>; children?: Node[] | string }
}

/** A text cut at a word boundary to fit its box, with an ellipsis. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`
}

/**
 * The one template of every social image: the site name, the page's title, its description. Plain on purpose:
 * v9-site-look restyles it. Built from a tree of plain objects, so no JSX runtime is involved.
 */
function template(input: { siteName: string; title: string; description: string }): Node {
  const box = (style: Record<string, string | number>, children: Node[] | string): Node => ({
    type: 'div',
    props: { style: { display: 'flex', ...style }, children },
  })
  return box(
    {
      width: socialImageSize.width,
      height: socialImageSize.height,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding,
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      color: '#111111',
      fontFamily: 'Inter',
    },
    [
      box({ fontSize: 32, fontWeight: 700 }, input.siteName),
      box({ flexDirection: 'column', gap: 24, width: contentWidth }, [
        box(
          { display: 'block', width: contentWidth, fontSize: 64, fontWeight: 700, lineHeight: 1.1 },
          clamp(input.title, 80),
        ),
        box(
          {
            display: 'block',
            width: contentWidth,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.3,
            color: '#444444',
          },
          clamp(input.description, 170),
        ),
      ]),
    ],
  )
}

/** A 1200 by 630 PNG for one page. Nothing is read from the system: fonts come from the package, so every host draws the same pixels. */
export async function renderSocialImage(input: {
  siteName: string
  title: string
  description: string
}): Promise<Uint8Array> {
  const svg = await satori(template(input), { ...socialImageSize, fonts })
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: socialImageSize.width },
    font: { loadSystemFonts: false },
  }).render()
  return png.asPng()
}
