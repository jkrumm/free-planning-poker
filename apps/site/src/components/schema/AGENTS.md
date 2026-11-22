# Structured data and social images

`base.astro` writes the social tags, Organization, WebSite and BreadcrumbList (indexed pages below `/`); a page adds its types in the `structured-data` slot (SoftwareApplication on `/`, Article on the pillar and every entry, DefinedTerm in the glossary).

- `<type>.ts` builds a typed object, `<type>.astro` writes it as one `application/ld+json` script through `json-ld.ts`, which escapes every `<`. `identity.ts` holds the names. The author is the Person the imprint names (Johannes Krumm), with no url because the imprint publishes no address or e-mail; the publisher is the Organization.
- FAQPage enters a page only through `questions.astro`, which prints the questions and writes the markup from the same array; `schema.test.ts` fails on another route. It sits in the body beside the text. Google shows no FAQ rich result since 2026-05-07; the owner's ruling keeps the markup.
- SoftwareApplication has no `aggregateRating` or `review` field, so none can be self-assigned. Google's rich result wants one, so the page forgoes it until real ratings exist.
- A new type adds its required properties, with their source, to the table in `test/schema.ts`; `schema.site.test.ts` reads every block of every output.
- BreadcrumbList names come from `src/lib/breadcrumbs.ts`: Home, the section (named in `strings.sectionNames`), the page. A nesting that is no section fails the build.

## Social images

`src/integrations/social-images.ts` runs at the end of each build, reads every built page's `og:title`, `og:description` and `og:image`, and writes the PNG at the path `og:image` names (`/og/<path>.png`, `/og/index.png` for `/`), 1200 by 630. One template, `src/lib/social-image.ts`: satori lays out a tree of plain objects, @resvg/resvg-js rasterises it. Chosen because nothing runs at request time, no external service or browser is involved, and the font (Inter from `@fontsource/inter`, never a system font) makes every host draw the same pixels. The Latin subset has no CJK glyphs: the first non-Latin page adds a font. The template is plain; `v9-site-look` restyles it.

`test/head.ts` fails any page, the 404 page and drafts on beta included, without a title, description, canonical link, Open Graph tags or an `og:image` file of 1200 by 630.
