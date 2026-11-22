/**
 * Bun's side of what the Vite plugin does for the app: macros (`t`, `plural`, `msg`) are compiled in the files
 * of `apps/room/src`, and a `.po` catalogue loads as the compiled messages Lingui reads. Registered for every
 * `bun test` by the `preload` in `bunfig.toml`; a file without a macro is left alone and nothing is imported.
 */
import { plugin } from 'bun'
import { relative, resolve } from 'node:path'

const MACRO = /from ['"]@lingui\/(?:core|react)\/macro['"]/
const CONFIG = resolve(import.meta.dirname, '../../../packages/i18n/lingui.config.ts')

plugin({
  name: 'lingui',
  setup(build) {
    build.onLoad({ filter: /apps\/room\/src\/.*\.tsx?$/ }, async ({ path }) => {
      const source = await Bun.file(path).text()
      if (!MACRO.test(source))
        return { contents: source, loader: path.endsWith('x') ? 'tsx' : 'ts' }
      const [{ transformSync }, { default: macro }, { getConfig }] = await Promise.all([
        import('@babel/core'),
        import('@lingui/babel-plugin-lingui-macro'),
        import('@lingui/conf'),
      ])
      const result = transformSync(source, {
        filename: path,
        babelrc: false,
        configFile: false,
        plugins: [[macro, { linguiConfig: getConfig({ configPath: CONFIG }) }]],
        parserOpts: { plugins: ['typescript', 'jsx'] },
      })
      return { contents: result?.code ?? source, loader: 'tsx' }
    })

    build.onLoad({ filter: /packages\/i18n\/locales\/.*\.po$/ }, async ({ path }) => {
      const [{ getConfig }, { createCompiledCatalog, getCatalogForFile, getCatalogs }] =
        await Promise.all([import('@lingui/conf'), import('@lingui/cli/api')])
      const config = getConfig({ configPath: CONFIG })
      const found = getCatalogForFile(relative(config.rootDir, path), await getCatalogs(config))
      if (!found) throw new Error(`no catalogue matches ${path}`)
      const { messages } = await found.catalog.getTranslations(found.locale, {
        fallbackLocales: config.fallbackLocales,
        sourceLocale: config.sourceLocale,
      })
      const { source } = createCompiledCatalog(found.locale, messages, { namespace: 'es' })
      return { contents: source, loader: 'js' }
    })
  },
})
