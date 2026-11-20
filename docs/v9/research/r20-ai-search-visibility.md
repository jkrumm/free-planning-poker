# Being found by search engines and assistants

Research run of 2026-11-20 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 44/44. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Citations and recommendations (1):** The strongest measured signal is off-site, third-party presence. Ahrefs (75,000 brands, Dec 2025) found YouTube mentions correlate most with AI visibility (about 0.737), then branded web mentions (0.66 to 0.71). Backlink and page-count metrics correlate weakly. Muck Rack's October 2026 edition finds about 99% of AI-cited links are non-paid and more than 84% are earned or third-party. These are correlations, not causal tests. Reddit, YouTube and Wikipedia shares move a lot by engine and month.
- **llms.txt and Markdown mirrors (2):** Adoption is about 28% of domains in one large sample, but 97% of those files got zero requests in May 2026. No major assistant has been shown to read llms.txt, and Google says it is neither needed nor harmful for Search. Cloudflare's Markdown for Agents works on content negotiation, but I found no evidence that assistants send that header. NLWeb and MCP have no evidence of effect on assistant recommendations.
- **Crawlers and robots.txt (3):** OpenAI, Anthropic, Perplexity and Apple publish separate search, user-triggered and training tokens, so a site can allow search and block training. Google-Extended controls Gemini training and grounding, not Search. As of late 2024 data (Vercel and MERJ), none of the major AI crawlers executed JavaScript except via Google's infrastructure for Gemini and Applebot. Cloudflare has blocked AI crawlers by default for new domains since 1 July 2025, so the setting must be checked rather than assumed.
- **Structured data (4):** FAQ rich results stopped appearing on 7 May 2026, and Google removed the FAQ documentation in June 2026. HowTo has been deprecated since 2023. Software app, Article, Breadcrumb and Organization are still in Google's structured data gallery. I found no measured effect of schema on AI citations.
- **Content architecture (5):** Google's scaled content abuse policy covers mass-generated pages and now applies to generative AI responses. Ahrefs found page count correlates weakly with AI visibility (about 0.19), so programmatic volume is not supported by the evidence. Pillar and cluster architecture has no primary measurement, only practitioner consensus.
- **Free tools and original data (6):** Only secondary, low-confidence data exists. Interactive tools appear to earn links; the evidence that they earn AI citations is thin.
- **GitHub README (7):** Only an association study (JSS 2023) links README quality to repository popularity. Conversion claims found online are unsourced.
- **Core Web Vitals (8):** Good thresholds are LCP at or below 2.5 s, INP at or below 200 ms and CLS at or below 0.1, measured at the 75th percentile. INP has been stable since 2024. Island cost is a mechanism (JavaScript download, execution and input blocked until hydration); I found no reliable quantified benchmark.
- **Bing and IndexNow (9):** Bing's AI Performance report (launched early 2026, expanded in preview June 2026) shows citations in Copilot and Bing AI experiences. IndexNow is supported by Bing, Yandex, Naver, Seznam and Yep, not Google. That ChatGPT search draws on Bing was not verified here.
- **Measurement (10):** Use Bing's AI Performance report, Search Console, GA4 referrer and channel reports, and your own edge logs for bot user agents. Umami runs in the browser, so JavaScript-free crawlers are probably invisible to it (an inference from section 3).

**Recommendation:** Keep the static Astro marketing site server-rendered, with explicit per-bot policy at Cloudflare. Keep /room pages out of the index. Build third-party mention presence (GitHub, YouTube, real community answers, directories) and one pillar with a few clusters. Add one free tool and one annual original-data page built from anonymised aggregates. Use only Organization, WebSite, SoftwareApplication (real ratings only), Article and BreadcrumbList markup. Skip FAQ and HowTo markup, llms.txt, MCP and NLWeb.

## 1. What measurably drives citations and recommendations

**Brand and third-party mentions.** Ahrefs analysed 75,000 brands against mentions in ChatGPT, AI Mode and AI Overviews, using Spearman correlation. YouTube mentions correlated most strongly (about 0.737). Branded web mentions were 0.66 to 0.71. Number of backlinks and URL rating were weak. Site page count was about 0.194. ChatGPT showed the weakest correlation with classic authority metrics: branded search volume 0.352, DR 0.266. The three assistants largely mention the same brands (output overlap 0.779). Ahrefs states that correlation is not causation. The 0.664 versus 0.218 backlink figure repeated online comes from secondary summaries of this study, not from the Ahrefs page itself.

**Earned media.** Muck Rack and Generative Pulse's October 2026 edition covers more than 40 million AI responses and 207 million citations in 2026, plus a September analysis of 1,020 prompts across ChatGPT, Claude, Gemini and Perplexity. Nearly 99% of cited links were non-paid, and paid or advertorial content was 0.3% of citations. Journalism fell from 27% of citations in May 2026 to 22% in September. Government and NGO sites rose to 9.6%, aggregators and encyclopedic sources to 18.3%, and third-party corporate content to 25.1%. Owned media rose to 15.2%. Only 212 domains were cited by all four providers in September. Muck Rack's 2025 edition reported 89% earned media and 27% journalistic content.

**Platform mix (Reddit, YouTube, Wikipedia).** Ahrefs' November 2026 ranking of Google AI Overviews citations across more than 3 million US queries gives these mention shares among the top 50 sources: YouTube 24.5%, Reddit 18.1%, Facebook 12.4%, Google 8.6%, Quora 4.4%, Wikipedia 4.4%. The September figures were YouTube 22.9% and Reddit 18.5%. A separate Ahrefs study of ChatGPT query fan-out (October 2026, search snippet) reports that Reddit appeared in about 1 in 5 ChatGPT answers in March 2026 and about 1 in 43 by late September. Wikipedia went from about 1 in 7 to about 1 in 35 over the same period. These shares move quickly, so do not build on one platform. An AirOps study of 353,799 pages (April 2026, reported in a secondary summary) puts Wikipedia's citation rate at 59.2% when ChatGPT retrieved it. Treat that figure as low confidence. Otterly's February 2026 report counts community platforms (Reddit, Quora) at 52.5% of citations, which uses a different sample and definition.

**Freshness (conflicting).** airanked.ai (October 2026, 742 Google AI Overview citations for B2B software queries) reports that the median cited page was updated 88 days before capture, and 87% within the past year. Machine Relations (November 2026, 774 paired pages across five engines) found the cited page was newer in 55% of pairs, by a median of three days. A secondary summary of Ahrefs' 2025 work reports that ChatGPT cites newer pages (about 458 days newer). Freshness plausibly helps some engines, but the effect size is unclear and the samples differ.

**Original statistics and quotations.** The Princeton GEO paper (arXiv 2311.09735, KDD 2024) reports visibility gains of up to 40% from content optimisation, with effects varying by domain. Its abstract does not isolate statistics or quotations, and it predates the 2025 to 2026 studies. I found no 2025 to 2026 measurement isolating statistics or quotations.

**Google's own position.** Google's AI features guidance says AI Overviews and AI Mode need no special requirements beyond indexing and snippet eligibility, and that AI Overviews only appear when they add value. Google's May 2026 guide says non-commodity content matters.

## 2. llms.txt and Markdown mirrors

**Adoption and reading (Ahrefs, June 2026).** Ahrefs examined 137,210 domains with traffic in May 2026. About 28% published llms.txt, roughly 38,000 files, and Ahrefs calls this an upper bound because its customers skew technical. Of valid files, 97% received zero requests in May. The 3% that were fetched received 96% bot requests. Named AI bots were 19.5% of those fetches, with GPTBot top and Claude-Code second. Third-party SEO audit tools, tech profilers and link-preview bots made more requests than any single AI bot. Chrome's Lighthouse audit made about 22 requests. Zero AI bots requested llms.txt files that did not exist.

**Google's position.** Google's documentation was updated on 15 June 2026 to say llms.txt is not needed for Google Search and will neither help nor hurt rankings or AI features, though keeping it is fine for other services. Search Engine Land (October 2026) reports a May 2026 Google statement to the same effect. A preprint quotes John Mueller (June 2025) as saying no AI system currently uses llms.txt (low to medium confidence, quoted secondhand). SE Ranking's study of about 300,000 domains reportedly found no direct impact on citation frequency (secondary).

**Markdown content negotiation and Cloudflare.** Cloudflare's Markdown for Agents (blog, 12 February 2026) converts HTML to Markdown on enabled zones when the client sends Accept: text/markdown. The output carries YAML frontmatter from meta tags and keeps JSON-LD as a fenced block. If the origin sends no content-signal header, Cloudflare adds Content-Signal: ai-train=yes, search=yes, ai-input=yes. That is an implicit policy grant, so check it. I found no evidence that any major assistant sends the Markdown Accept header.

**NLWeb.** Microsoft's NLWeb (repository first published April 2025) turns Schema.org site data into conversational endpoints, and each endpoint also serves as an MCP server. agentswelcome.dev lists its status as emerging (June 2026). I found no evidence that major assistants query NLWeb endpoints.

**MCP server.** Exposing an MCP server gives agent clients tools. I found no evidence that it affects assistant recommendations for a free web app. It adds attack surface to a room server with anonymous users, so skip it for marketing.

## 3. AI crawler user agents and robots.txt

**OpenAI** (developers.openai.com/api/docs/bots):
- OAI-SearchBot is for search. Sites that opt out will not appear in ChatGPT search answers, though they can still appear as navigational links. Robots.txt changes can take about 24 hours to take effect.
- GPTBot is for training. Disallowing it signals no training use.
- ChatGPT-User is for user-initiated visits. OpenAI says robots.txt rules may not apply to it, and it is not used to decide search inclusion.

**Anthropic** (support.claude.com help article):
- ClaudeBot collects content for training.
- Claude-SearchBot indexes content to improve search results.
- Claude-User fetches pages for user queries. Disabling it may reduce user-directed visibility.
- Anthropic supports Crawl-delay. From 30 October 2026, it recognises a machine-readable "no AI training" preference signal based on the IETF aipref draft. Rules that name ClaudeBot take priority over the general signal.
- Muck Rack reports that among major publishers blocking Claude's search crawler, 81% received almost no Claude citations, against 12% of publishers that allowed it. This is correlational.

**Perplexity** (docs.perplexity.ai/docs/resources/perplexity-crawlers):
- PerplexityBot surfaces and links sites in Perplexity search. It is not used for foundation model training.
- Perplexity-User handles user-initiated actions. Perplexity says it generally ignores robots.txt for these.
- Cloudflare Bot Fight Mode can still challenge Perplexity bots even when a WAF skip rule is in place.

**Google:**
- Googlebot governs eligibility for AI Overviews and AI Mode. There is no separate AI Search crawler.
- Google-Extended controls use for Gemini training and grounding. It does not affect Search. Sites that allow Google-Extended are eligible to appear in Gemini app grounding.
- Google's 30 October 2026 blog announces a shared AI training policy token in robots.txt, with support planned for 2027. If the token opts out and Google-Extended is not named, Google will treat it as a Google-Extended disallow.

**Apple** (support.apple.com/en-us/119829): Applebot powers Spotlight, Siri and Safari search. Applebot-Extended opts content out of training foundation models. The nosnippet meta tag opts content out of world-knowledge answers. Applebot may still crawl the page.

**Bingbot and CCBot:** I did not read Bingbot's or Common Crawl's policy pages, so their specifics are unverified. Vercel and MERJ report that CCBot does not render pages.

**Cloudflare defaults:** On 1 July 2025 Cloudflare announced it would block AI crawlers by default for new domains, asking each domain upfront whether to allow them (Cloudflare press release; Nieman Lab). Cloudflare's pay-per-crawl was launched as a private beta. I found no evidence that pay-per-crawl turns on silently, but I did not check the current dashboard defaults for existing zones. Check Bot Fight Mode, AI Crawl Control and any managed robots.txt on the zone.

**Do AI crawlers execute JavaScript?** The Vercel and MERJ analysis (December 2024; Vercel's network plus nextjs.org and two job boards) found that none of OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, PerplexityBot, Meta-ExternalAgent or Bytespider render JavaScript. ChatGPT and Claude fetch JavaScript files without executing them. Gemini uses Googlebot's infrastructure and renders. Applebot renders. CCBot does not render. Content present in the initial HTML response, including JSON, is what these crawlers see. Adobe's November 2026 article restates the finding, but I found no 2026 re-test, so treat it as current but dated. For this project the practical rule is that marketing text must be in static HTML. The /room React SPA needs no AI visibility.

## 4. Structured data in 2026

- **FAQPage:** Google's documentation says FAQ rich results will not appear from 7 May 2026. The deprecation notice was added on 8 May 2026, and the FAQ documentation was removed in June 2026. Before that, from September 2023, the feature was limited to well-known government and health sites (secondary). The markup is still valid schema.org but has no Google feature. Drop it for SEO purposes.
- **HowTo:** Google deprecated the How-to rich result in 2023, first on mobile and then on desktop (secondary dates: 8 August and 13 September 2023). It is absent from Google's current gallery. Drop it.
- **SoftwareApplication ("Software app"):** Still listed in Google's gallery (rating information, description and link). Google added a guideline on 24 July 2026 about fake and undisclosed incentivised reviews. Mark up only real aggregate ratings, never self-assigned ones.
- **Article:** Listed (news, sports and blog articles). Use real datePublished and dateModified.
- **BreadcrumbList:** Listed.
- **Organization:** Listed (logo, legal name, contact and identifiers). Useful as a stable entity anchor.
- **Removals:** Google removed documentation for course info, estimated salary, learning video, special announcement and vehicle listing in September 2025. It phased out practice problem (January 2026) and dataset markup in Search.
- **Effect on AI citations:** I found no measured effect of schema on assistant citations. Google says AI features need no extra requirements. Treat schema as a cheap baseline, not a citation lever.

## 5. Content architecture and E-E-A-T

- **Scaled content abuse:** Google defines it as generating many pages mainly to manipulate rankings and not to help users. Google's generative AI guidance says generating many pages without added value may violate the policy. Google's May 2026 update says spam policies apply to generative AI responses too. The doorway abuse section covers substantially similar pages that sit closer to search results than a browsable hierarchy, and city or region funnel pages.
- **Programmatic pages:** Ahrefs' correlations do not support programmatic volume as an AI visibility strategy. Avoid thin 'alternatives to X' and location-style pages.
- **Pillar and clusters:** I found no primary measurement. Bing's Topic Portfolio (beta, November 2026) groups grounding queries into topics, which suggests topic-level coverage matters to at least one engine. Treat pillar-and-cluster as a practice with low evidence.
- **Glossary, comparison and alternative pages:** No measured citation data found. Keep comparisons factual, dated, sourced and methodological. Competitor claims need citations.
- **E-E-A-T for a solo developer:** Google updated its generative AI content guidance on 1 October 2026 with Search Quality Rater Guideline material, which I did not read. The practical signals are a named maintainer, public repository history, dated changelogs, a clear About page with contact, and honest update dates. There is no measured effect of these signals on AI citations.

## 6. Free interactive tools and original data as link magnets

- FluxWriter (blog, July 2026) reports that interactive calculators averaged about 38 referring domains for about 22 hours of effort. Methodology not verified. Low confidence.
- Alejandro Meyerhans' census (July 2026) of 200 calculator keywords (555 ranked results across 326 domains) suggests calculators are common among ranking pages. I read only the summary. Low confidence.
- Ahrefs finds backlinks only weakly correlated with AI visibility, so links help Google rankings and referral traffic more than they help AI mentions. Brand mentions across third-party sources matter more for assistants.
- Original data: Muck Rack's findings favour source-worthy research. For this project, a yearly page of anonymised aggregate estimates (for example, reveal distributions across rooms) is credible if it cannot identify any room or person. It requires deciding now what the reducer and telemetry keep.

## 7. GitHub README as entry point

- A 2023 Journal of Systems and Software study reports an association between README quality and repository popularity. It is correlational.
- Vendor and blog claims (for example, 3 to 5 times more stars) have no traceable source. Do not rely on them.
- Practical README elements, based on the association and common practice: one-sentence purpose, live link to the app and to the marketing site, a screenshot or GIF, a self-hosting path that works in one command, a short FAQ, license, and consistent brand naming. Conversion from README to use is unmeasured.

## 8. Core Web Vitals thresholds and island cost

- web.dev (last updated 31 October 2024): LCP at or below 2.5 s, INP at or below 200 ms, CLS at or below 0.1. Measure at the 75th percentile of page loads, separately for mobile and desktop.
- INP replaced FID and became stable in 2024. Stable metrics change at most once a year.
- A 2026 SEO blog states INP as the 98th percentile. That contradicts the 75th-percentile guidance on web.dev, so use web.dev.
- Islands: Astro ships JavaScript only for components with client directives. Components without a directive render to static HTML at build time (secondary).
- Hydration cost: JavaScript must download, execute and hydrate before the page responds to input (completefrontend, November 2026, secondary). I found no reliable quantified INP benchmark for island counts.

## 9. Bing Webmaster Tools and IndexNow

- Bing's AI Performance report shows which pages are cited in Copilot and Bing AI answers, and the grounding queries behind them. The June 2026 Bing blog adds four preview capabilities: Intents, Topics, Citation Share and Compare. It describes coverage of Copilot, Bing and select partner AI experiences, not ChatGPT. Topic Portfolio (beta) followed in November 2026 (itbrief).
- IndexNow is a simple ping to tell search engines that URLs were added, updated or deleted. indexnow.org lists Microsoft Bing, Naver, Seznam.cz, Yandex and Yep as supporters. Google is not listed.
- ChatGPT search drawing on Bing was not verified in this research.

## 10. Measuring AI visibility for free

- **Google:** The Search Central page on identifying traffic from Google Search using HTTP Referer headers was added on 12 November 2026. Search Console counts AI Mode data in its totals since June 2025. Whether Search Console isolates AI Overviews was not verified.
- **GA4:** A secondary source reports that GA4 added an AI Assistants channel on 13 May 2026. I did not verify this in Google's documentation. Assistant apps often send no referrer and land in direct traffic (secondary).
- **Bing:** The AI Performance report is free and first-party for Copilot and Bing AI.
- **Bots:** Edge or Traefik access logs with user agent fields give the only reliable view of AI crawler hits. Umami's browser-based tracker is likely blind to non-JavaScript bots (an inference from section 3).
- **Prompt panels:** Muck Rack's September 2026 repeat test found ChatGPT repeated only 41% of cited domains when the same prompt was run twice in one day. Gemini repeated 45% and Perplexity 94%. Single-answer checks are unreliable. Use a fixed prompt set, repeated over time.

## Decide now (cannot be retrofitted cheaply)

1. **Indexing of /room/<slug>.** Rooms are anonymous and ephemeral. Decide noindex and sitemap exclusion before launch, and what the HTML head shows.
2. **Origin layout.** Whether marketing and the app share a domain determines robots.txt, cookies and Cloudflare zone settings. Pick one.
3. **URL scheme for guide, glossary and comparison pages**, including slug and trailing-slash rules. Changing them later loses citations and links.
4. **Brand name and handles.** Mentions correlate most with AI visibility. The name must be searchable, consistent across the repository, npm package, YouTube channel and directories. 'Planning poker' is generic.
5. **Per-bot policy.** Decide training opt-in or opt-out for GPTBot, ClaudeBot, Google-Extended, Applebot-Extended and CCBot, and allow search and user bots. Training crawls are not reversible for data already collected.
6. **Edge logging.** Start recording bot user agents and referrers now. Past hits cannot be recovered.
7. **Telemetry for an original-data page.** Decide now what the reducer and telemetry keep. Aggregate-only event design cannot be added retroactively. This is an inference from the design, not a sourced finding.
8. **dateModified semantics.** Update only for real content changes, so freshness signals remain honest.
9. **Static marketing content.** Marketing text must be in HTML, not assembled in the browser.

## Prioritised checklist for a solo maintainer

Evidence grades: A = primary vendor or Google documentation or official data; B = large measured or correlational study; C = single secondary source or blog; D = speculation.

1. **Static, server-rendered marketing pages on Astro** (A for crawler JS behaviour, 2024 data; B for consistency). Low effort.
2. **Explicit Cloudflare AI bot settings.** Verify Bot Fight Mode, managed robots.txt and any pay-per-crawl or AI Crawl Control defaults. Check Markdown for Agents content-signal behaviour. Allow OAI-SearchBot, Claude-SearchBot, Claude-User, PerplexityBot and Perplexity-User. Decide training bots explicitly (A for vendor token definitions).
3. **Keep /room pages out of the index** (A for the policy need; inference on thin content).
4. **Build third-party mention presence:** GitHub repository, YouTube demonstration video, real answers in relevant communities without links or promotional spam (Google's link spam rules cover forum comments with optimised links), agile tool directories (B for correlation with brand mentions).
5. **One pillar on story point estimation and several cluster pages, plus a glossary.** Each page answers one real question with dated, sourced claims. Avoid programmatic volume (C for structure; A for the spam policy; B for weak page-count correlation).
6. **One free tool** (for example, a planning-poker-to-velocity estimator or a story-point calibration aid). Link magnet with low-confidence evidence (C).
7. **One original-data page per year** from anonymised aggregates, with methodology and dated updates (C; supported by Muck Rack's emphasis on source-worthy research).
8. **Structured data baseline:** Organization, WebSite, SoftwareApplication (real ratings only), Article with honest dates, BreadcrumbList. Remove FAQ and HowTo markup (A for FAQ and HowTo status).
9. **Core Web Vitals:** keep island count low; field-measure INP at the 75th percentile against 200 ms (A).
10. **Bing Webmaster Tools and IndexNow ping on deploy** for Bing and Copilot visibility (A for IndexNow support list; B for AI Performance report function).
11. **Measurement:** GA4 referrer grouping, Search Console, Bing AI Performance report, edge bot logs, and a fixed repeated prompt panel (A for Bing and Google features; B for variance data).
12. **README** written for the question it answers, linking to the site (C).
13. **llms.txt:** optional and cheap; no measured citation benefit (A for Google's statement; B for Ahrefs adoption and fetch data). Do it only if you already maintain docs for coding agents.
14. **Markdown mirrors and Cloudflare Markdown for Agents:** skip until assistants are shown to request them (D for assistant use; A for behaviour).
15. **NLWeb and MCP:** skip for marketing (D). Revisit only for agent integrations.

## Tradeoffs

- Most AI-visibility evidence is correlational and vendor-produced (Ahrefs, Muck Rack). Causal tests are missing.
- Third-party presence is slow to build and depends on others. On-site changes are fast but evidence for them is weak.
- Original data and room telemetry pull against the privacy promise of anonymous rooms. Keep aggregates only.
- Cloudflare's convenience features can change crawler access without notice. Explicit configuration costs time but prevents accidental blocks or grants.

## Unverified and open

- Current 2026 JavaScript rendering behaviour of AI crawlers (primary data is December 2024).
- Whether Bing feeds ChatGPT search, and how much AI referral traffic a site like this would receive. I found no measured volume.
- Search rankings for planning-poker queries. No live SERP data was collected.
- Google's Search Quality Rater material on E-E-A-T (updated 1 October 2026) was not read.
- Bingbot and CCBot policy pages were not read.
- Whether assistants send Accept: text/markdown.
- Pillar and cluster effects on AI citation and rankings.
- Quantified island cost on INP.
- Stack components (Bun, Elysia 2 release candidate, Zod 4, Drizzle, React 19, Vite, Astro, Umami, ClickStack) were outside this question and were not researched, so their versions and release dates are not verified here.
- Whether the GA4 AI Assistants channel exists as described (secondary only).

## Not verified

- Current 2026 JavaScript rendering behaviour of AI crawlers: Primary data is December 2024; restatements in 2026 are secondary. No 2026 re-test found.
- Whether Bing feeds ChatGPT search, and how much AI referral traffic a site like this gets: Not verified in any source read; no measured referral volume found.
- Search rankings for planning-poker and story point queries: No live SERP data was collected in this research.
- Google's E-E-A-T and Search Quality Rater guidance (updated 1 Oct 2026): Only the update entry and snippet were seen; full guidance not read.
- Bingbot and CCBot policy and behaviour: Crawler documentation for Bingbot and CCBot was not read; CCBot rendering comes from the 2024 Vercel and MERJ analysis only.
- Whether assistants send Accept: text/markdown: Cloudflare documents the behaviour; no source shows any assistant using it.
- Effect of pillar and cluster architecture on AI citations or rankings: No primary measurement found; practitioner consensus only.
- Quantified INP cost of interactive islands: Mechanism described by a secondary source; no reliable benchmark found.
- Whether Google Search Console isolates AI Overviews traffic: Search Console counts AI Mode in totals; AI Overviews isolation not verified.
- GA4 AI Assistants channel (13 May 2026): Only secondary sources; Google's own documentation not read.
- Current Cloudflare dashboard defaults for existing zones (AI crawl blocking and pay-per-crawl): Default for new domains is documented; the state of existing zones and pay-per-crawl activation was not checked in the dashboard.
- Link-magnet and calculator evidence: Only snippets and blog summaries read; methodology not verified; low confidence.
- Wikipedia citation rate of 59.2% (AirOps): Secondary summary of a study; not read at source.
- Stack components (Bun, Elysia 2 RC, Zod 4, Drizzle, React 19, Vite, Astro, Umami, ClickStack): versions and release dates: Outside the research question; not checked.
- Google-Extended specifics in Google's crawler documentation: The Google-Extended section was truncated in the read; behaviour relies on Google's October 2026 blog post.

## Sources

- https://developers.openai.com/api/docs/bots
- https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- https://ahrefs.com/blog/llmstxt-study/
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://ahrefs.com/blog/ai-brand-visibility-correlations/
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/essentials/spam-policies
- https://vercel.com/blog/the-rise-of-the-ai-crawler
- https://blog.cloudflare.com/introducing-pay-per-crawl
- https://web.dev/articles/vitals
- https://developers.google.com/search/updates
- http://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/
- https://muckrack.com/blog/what-is-ai-reading-october-2026
- https://muckrack.com/blog/what-is-ai-reading
- https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- https://www.indexnow.org/
- https://arxiv.org/abs/2311.09735
- https://developers.google.com/search/blog/2026/10/ai-training-control.md.txt
- https://support.apple.com/en-us/119829
- https://www.niemanlab.org/2025/07/cloudflare-will-block-ai-scraping-by-default-and-launches-new-pay-per-crawl-marketplace/
- https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/
- https://ahrefs.com/blog/most-cited-domains-ai-overviews/
- https://ahrefs.com/blog/query-fan-out-chatgpt/
- https://www.airops.com/blog/ai-search-statistics
- https://airanked.ai/research/content-freshness-ai-overviews
- https://machinerelations.ai/research/do-ai-engines-cite-fresher-pages-2026
- https://searchengineland.com/guide/llms-txt
- https://open.rankfor.ai/resources/is-llms-txt-worth-it/
- https://blog.cloudflare.com/markdown-for-agents/
- https://agentswelcome.dev/protocols/nlweb
- https://github.com/nlweb-ai/NLWeb
- https://obsurfable.com/resources/articles/bing-ai-performance-report-publishers-guide
- https://itbrief.co.uk/story/microsoft-launches-topic-portfolio-in-bing-webmaster-tools
- https://themeisle.com/blog/track-ai-referral-traffic-ga4/
- https://fluxwriter.com/blog/linkable-asset-framework-types-ranked
- https://dl.acm.org/doi/abs/10.1016/j.jss.2023.111806
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://www.optimizely.com/field-notes/articles/does-llms-txt-work
- https://zenodo.org/records/23128812/files/hall-2026-discovery-not-adoption-v1.2.pdf?download=1
- https://completefrontend.com/web-performance/hydration-cost
- https://experienceleague.adobe.com/en/perspectives/ai-search-visibility-why-web-content-gets-skipped
- https://www.metavert.io/state-of-ai-search-citations
- https://www.airanklab.com/blog/content-freshness-ai-citations
- https://alejandromeyerhans.com/research/linkable-assets/
- https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026
- https://platform.openai.com/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-prevent-crawling
- https://docs.perplexity.ai/guides/bots
- https://developers.google.com/search/docs/appearance/structured-data/faqpage
