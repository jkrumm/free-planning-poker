# apps/site content rules

Read on reach from `apps/site/AGENTS.md`: the rules for the site's comparisons, glossary and guides. Moved verbatim from that file; nothing else changed.

## The comparisons

`src/content/vs` holds at most five drafts (`src/lib/vs.test.ts`). The frontmatter is `vsSchema`: the tool and its `origins` (the address prefixes that count as its own pages), `checked`, and `facts`, each with a claim, its `source`, the day it was `read`, `ours` and who is `ahead`. Read every fact on the day from the tool's own page (`agw web read <url> --ask ...`), never from memory or `docs/v9/research`; the body repeats no fact the table lacks. Our side is what 9.0.0 does per `docs/v9/UX.md`, no planned feature; no logo, no screenshot. Before publishing, re-read every source and move `checked`, `updated` and each `read` together.

## The glossary

`src/content/glossary` holds at most 15 terms (`src/lib/glossary.test.ts`); the title is the term, and the first sentence of the body must contain it. A link from one entry to another goes through `visibleEntry` in `src/lib/entries.ts`: frontmatter `related` and `guide` become links only where the target is shown in the build, so no published page links a draft and a missing cluster page leaves no broken link. `guide` names a cluster entry id of `guideClusters` (`src/lib/entry-schema.ts`). DefinedTerm and DefinedTermSet are `components/schema/defined-term*.astro` over typed builders; the JSON-LD serialiser is `components/schema/json-ld.ts`.

## The guides

`src/content/pillar/guide.md` is the one entry of the `pillar` collection, read through `pillarEntry`; `guide.astro` keeps v1's anchor `master-the-art-of-planning-poker`. Cluster pages are drafts, `src/content/guides/<slug>.md` at `/guides/<slug>`; the slugs are `guideClusters`, and renaming one loses links. Pages link each other through `visibleEntry`, never in a Markdown body; `guide.astro` lists the glossary terms under the text. A cluster page asks its question in the title, follows `docs/v9/UX.md` and dates its sources.
