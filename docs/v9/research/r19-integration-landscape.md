# The integration landscape: 22 work tools

Research run of 2026-11-20 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 59/59. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Jira Cloud (largest share, about 62% of teams):** since 17 Sep 2025 only Forge apps can be listed on the Atlassian Marketplace. Forge Custom UI serves bundled iframe content, so a Jira panel that frames your own site is not the standard Forge model. Native Jira means building a Forge app, which is high effort.
- **Cheapest native surfaces that frame a URL you own:** Trello Power-Up (iframe connector), Microsoft Teams tab, Zoom Apps, Google Meet add-on, Miro app, Azure DevOps web extension. All reuse one embeddable SPA route. Each needs a review step, and none needs a server secret just to frame the page.
- **Write-back:** every tracker with a token API can take an estimate, but a server-held OAuth client secret is needed for Azure DevOps (Entra), Linear, Notion public integrations, GitLab OAuth and GitHub Apps. A user-pasted personal token, used directly from the browser, avoids storing any secret, if the tracker's CORS policy allows it. CORS per tracker is not verified here.
- **Generic paths:** CSV import/export and pasted keys cover every tool with no auth and no review. Outgoing webhooks reach write-back through Zapier, Make and n8n with no secret on your side. Unified APIs (Merge, Unified.to) bill per connected end user or per call and assume customer accounts, so they do not fit a free no-account tool.
- **Recommended order:** (1) CSV in and out, pasted keys, signed webhook out; (2) make the SPA frame-ready and ship Trello, Teams, Zoom and Meet surfaces; (3) Azure DevOps web extension; (4) Jira via Forge; (5) Linear, GitHub, ClickUp, Asana, monday and others only on demand. Details at the end.

## Method and limits

I used 38 of the 40 allowed tool calls. Primary pages read in full or in part: the Atlassian Forge permissions reference, the Atlassian Forge egress page (mostly navigation text), the Trello Power-Up tutorial, the Azure DevOps OAuth page on Microsoft Learn, the Asana app-components doc, and the TeamRetro planning-poker comparison. Most other platform facts come from search-result snippets of official documentation. Snippets from blogs, aggregators and competitor pricing pages are marked low confidence. Items I did not verify are listed under `unverified`. Dates are as of 20 Nov 2026.

## 1. Usage share (question d)

- Digital.ai's 18th State of Agile Report (2025) is reported by secondary aggregators: Jira leads team-level tooling at 62%, Mural or Miro at 32%, and more than three in five agile teams use Jira to run Scrum (breeze.pm, xtendedview; medium confidence, secondary). I did not open the Digital.ai report itself.
- No public survey share was found in the sources I read for Azure DevOps, GitHub Projects, GitLab, Linear, ClickUp, Asana, monday.com, Trello, Shortcut, YouTrack, Notion, Confluence, Teams, Slack, Zoom, Meet, Plane, OpenProject or Taiga. The ordering below after Jira is therefore my judgement and is marked unverified.
- Working order by usage among software teams: Jira; Azure DevOps and GitHub Issues/Projects (unverified, high in enterprise and developer tooling); GitLab; Trello, Linear, ClickUp, Asana and monday.com (unverified, mid-tier); Shortcut, YouTrack, Notion, Confluence, Miro (unverified, smaller). Plane, OpenProject and Taiga are small open-source trackers, with no share data found.

## 2. Planning-poker tools that already integrate (question e)

From the TeamRetro comparison (updated 2 Aug 2026) and the vendor pages it cites (vendor self-description, medium confidence):

- **Jira:** TeamRetro (import, and write story points back), Kollabe (paid), Parabol, Planning Poker Online, PlanningPoker.com (import and export), PlanningPoker.live (two-way). Point Poker has no Jira plugin and uses CSV export and bulk import. Native Jira apps (Appfire Planning Poker, Agile Poker) sit inside Jira.
- **Azure DevOps:** TeamRetro, Kollabe, Parabol, Planning Poker Online.
- **GitHub:** TeamRetro, Kollabe, Parabol, Planning Poker Online.
- **Linear:** TeamRetro, Kollabe, Planning Poker Online, PlanningPoker.live (two-way).
- **GitLab:** Parabol only.
- **Slack:** PlanningPoker.live starts sessions from Slack.
- **None found:** Trello, ClickUp, Asana, monday.com, Shortcut, YouTrack, Notion, Miro, Teams, Zoom, Meet, Plane, OpenProject, Taiga.

The market expectation is clear for Jira, Azure DevOps, GitHub and Linear. Most competitors do API sync, not iframe surfaces.

## 3. Per-tool survey (questions a to c)

### Jira Cloud
- **(a) Surface and constraints:** Connect is closed. Since 17 Sep 2025 only Forge apps can be submitted to the Marketplace, and from March 2026 Connect descriptors no longer receive updates (Atlassian). Forge Custom UI 'runs within an iframe' and serves static HTML, CSS and JavaScript (Atlassian docs). The manifest's content section sets CSP script and style sources, and external fetch needs a declared external permission. That external permission can make an app ineligible for 'Runs on Atlassian' (permissions reference, read). I found no Forge option to frame an arbitrary remote site as the module body; that inference is medium confidence. Auth is Atlassian OAuth 2.0 (3LO) or an API token; Forge handles user auth.
- **(b) API and estimate field:** REST v3 search at GET /rest/api/3/search/jql (secondary, low). The story-points field is a numeric custom field whose ID differs per site (Atlassian's Data Center migration note uses customfield_11203 for a different field). Look it up with GET /rest/api/3/field; customfield_10016 is common but not universal. Write with PUT /rest/api/3/issue/{key}. Server secret: not needed for a Forge app, which runs on Atlassian's runtime; a plain external app needs the 3LO client secret.
- **(c) Marketplace, cost, review:** Submission is free and Atlassian aims to decide within about a week (alpstack, secondary, low). Multi-product apps can only be listed as paid, so a free Jira listing needs a Jira-only app ID (Atlassian community post, low). Forge pricing moved to consumption-based billing in January 2026 with a free tier (LinkedIn, low; treat as unverified). Free hobby apps are accepted on the Marketplace.
- **Usage:** highest of the set (see section 1).
- **Poker tools:** six of seven reviewed integrate with Jira.

### Jira Data Center
- Not verified. Data Center apps and Connect support on Data Center were not checked. Treat any Data Center plan as an export-and-import (CSV) path until checked.

### Azure DevOps Boards
- **(a) Surface:** web extensions with hub (full-page) and contribution iframes. The SDK bridges the host page and the extension iframe (sample repository, secondary). Packaged as a VSIX and published to the Visual Studio Marketplace under a publisher (Microsoft Learn overview, read via snippet).
- **(b) API and auth:** Microsoft Entra ID OAuth is the recommended option. Azure DevOps OAuth is deprecated, accepts no new registrations since April 2025, and is scheduled for full deprecation in 2026 (Microsoft Learn OAuth page, read). Global personal access tokens: a Microsoft Q&A thread (medium confidence) says the decommission date moved from 1 Dec 2026 to 27 Jan 2027. Read work items through the REST API or WIQL. The Agile story-points field is expected to be Microsoft.VSTS.Scheduling.StoryPoints (unverified in this run). A confidential Entra app needs a client secret; an extension can use the host-issued token instead, which I did not verify.
- **(c) Cost and review:** publisher account and extension listing are free for public extensions per the secondary sources I saw; the review turnaround was not verified.
- **Context:** the host supplies work item context, so a panel can open on the current work item without the user pasting anything.

### GitHub Issues and Projects
- **(a) Surface:** no third-party iframe panel inside Projects or Issues was found in this survey (unverified absence). Integration is through GitHub Apps and the Marketplace.
- **(b) API and estimate field:** Issues have no native estimate. Estimates usually live in a Projects v2 custom number field, which is written through GraphQL. The token needs the read:project (queries) or project (mutations) scope, from a classic PAT or a GitHub App installation token (GitHub Docs, read via snippet). Auth: PAT, or a GitHub App for multi-user use with a private key the server would hold.
- **(c) Cost and review:** free Marketplace listing for GitHub Apps was not verified here.
- **Poker tools:** four of seven reviewed integrate with GitHub.

### GitLab
- **(a) Surface:** no iframe panel found (unverified). Integration is webhooks and REST.
- **(b) API and estimate field:** the Issues API exposes weight (integer). The weight filter is marked 'Premium and Ultimate only' in the docs (GitLab Docs, read via snippet), so the estimate may be tier-restricted. Auth: OAuth 2.0 tokens or personal access tokens (GitLab REST authentication docs, read via snippet). OAuth client registration needs a secret held server-side.
- **Poker tools:** Parabol only.

### Linear
- **(a) Surface:** no third-party iframe surface found (unverified).
- **(b) API and estimate field:** GraphQL at https://api.linear.app/graphql. Rate limits: API key 2,500 requests per hour per user, OAuth 5,000 per hour per authenticated user or app user (Linear developer docs, and Throttle, secondary). OAuth with PKCE needs no client secret, per a community project (low confidence). The estimate is an integer field on issues; I did not verify the field name in this run.
- **(c) Cost and review:** OAuth apps are registered at linear.app/settings/api/applications (secondary, low). No listing fee or review found.
- **Poker tools:** four of seven reviewed integrate with Linear.

### ClickUp
- **(a) Surface:** no iframe surface found (unverified).
- **(b) API and estimate field:** REST v2. POST https://api.clickup.com/api/v2/task/{task_id}/field/{field_id} sets one custom field; a Number field takes a number (ClickUp developer docs, read via snippet). Auth: personal API token from Settings, or OAuth2 for multi-user apps (secondary, low).
- **(c) Cost and review:** not verified.

### Asana
- **(a) Surface:** app components on tasks. An entry point opens a modal form or a lookup. The lookup lets users paste a URL or ID, or pick from typeahead. A widget then shows the attached resource (Asana developer docs, read). These are Asana-rendered UI components, not arbitrary iframes, and the app server must serve the endpoints. Approval uses an 'app component approval checklist' (page navigation, not read).
- **(b) API and estimate field:** GET /api/1.0/workspaces/{workspace_gid}/tasks/search needs the tasks:read scope (Asana API reference, snippet). Estimate is a custom field on tasks; custom field write endpoint not verified here. Auth: personal access token or OAuth; the server holds the OAuth secret.
- **(c) Cost and review:** not verified.

### monday.com
- **(a) Surface:** apps with board views and item views. Item views open inside an item's updates section (monday developer docs, snippet). Whether these host an external web page in an iframe, and under what CSP, was not verified.
- **(b) API and auth:** GraphQL at https://api.monday.com/v2 with a personal or OAuth token in the Authorization header (secondary, 2024 guide). Its rate limits are from a 2024 guide and are likely out of date.
- **(c) Cost and review:** a free developer account is available; submission to the marketplace is documented (monday developer docs), with cost and review time not verified.

### Trello
- **(a) Surface:** Power-Ups. The iframe connector is a public HTTPS page that Trello loads in a hidden iframe; it talks to Trello through postMessage. CORS must allow https://trello.com. Capabilities such as card-buttons put a button on the card back (Trello Power-Up tutorial, read). Registration is at trello.com/apps/admin.
- **(b) API and auth:** Trello REST API with the Power-Up's API key and a user token; OAuth 2.0 is documented (Trello docs, search snippet). Estimate: a custom field, Number or List type, on the board. Context is strong: t.card() gives the open card's fields, so no pasting is needed.
- **(c) Cost and review:** a 'Submit Your Power-Up' page and public Power-Up guidelines exist; cost and review time not verified.
- **Poker tools:** none found.

### Shortcut
- **(a) Surface:** no marketplace iframe surface found (unverified).
- **(b) API and estimate field:** REST v3, for example POST /api/v3/stories, with an apiKey (Jentic API listing, secondary). Story estimate is an integer field (cheat sheet, secondary). Shortcut projects also report num_points (OpenAPI listing).
- **(c) Cost and review:** not verified.

### YouTrack
- **(a) Surface:** Apps can add widgets to supported YouTrack UI locations, expose HTTP handlers, and read data through the Host API (JetBrains Developer Portal, snippet). Widgets are app-hosted content, not arbitrary remote pages (inference).
- **(b) API and estimate field:** REST API for issue read and write (JetBrains docs). Estimation is a period field, set with a command such as 'Estimation 1w2d3h' (old community post, low confidence).
- **(c) Cost and review:** not verified.

### Notion
- **(a) Surface:** the embed block accepts content from an allowlist of providers (Notion help: over 1,900 domains, 2021 article, stale). An arbitrary room URL is probably not on that list (unverified).
- **(b) API and auth:** version header Notion-Version 2026-03-11 is required on every request (Notion developer skill, snippet). Internal connections use a static token. Public integrations use OAuth 2.0 with a per-user token, so the server holds a client secret (Notion developer docs).
- **(c) Cost and review:** not verified.

### Confluence
- **(a) Surface:** Forge only (Connect is closed). Custom UI and UI Kit macros and full-page modules run inside Confluence (Forge docs).
- **(b) API:** Confluence is a page store, not an issue tracker. Estimates would live in Jira, so Confluence is a host surface only.
- **(c) Cost and review:** same as Forge (see Jira).

### Miro
- **(a) Surface:** Miro Web SDK 2.0 apps. The app is a web page set as sdkUri in the app manifest and runs inside the board (Miro developer docs, plus secondary guides).
- **(b) Estimate:** no ticket store. Miro is a whiteboard, so estimates are sticky notes, not tracker fields.
- **(c) Marketplace:** an app needs a Miro Partner status and approval (Miro developer docs). Secondary guides say: 50+ monthly active users for two months, installs at 10+ organisations, a free submission, and 8 to 12 weeks of review (alpstack, low confidence).
- **Usage:** Mural or Miro about 32% of team-level tooling (secondary, see section 1).

### Microsoft Teams (tabs)
- **(a) Surface:** tabs (personal, channel or group) load your HTTPS page in an iframe. Teams requires X-Frame-Options and CSP frame-ancestors headers that allow Teams origins (Teams tab requirements, Microsoft Learn, snippet).
- **(b) Ticket integration:** none native. Tickets need the tracker's API, so Teams only provides the room.
- **(c) Publishing:** Teams Store publishing goes through validation, a Partner Center listing, publisher verification and attestation (Microsoft Learn, snippet). Cost and review time not verified.

### Slack
- **(a) Surface:** Block Kit surfaces: messages, modals, App Home (Slack developer docs, snippet). Canvases are not Block Kit. I found no surface for framing an arbitrary third-party web page (medium confidence, based on the surfaces list).
- **(b) Integration:** slash commands and message buttons call your server; the server then uses the tracker's API.
- **(c) Cost and review:** not verified.

### Zoom Apps
- **(a) Surface:** Zoom Apps SDK runs a web app inside the Zoom client (Zoom developer blog, 2022, primary).
- **(b) Ticket integration:** none native; the room is the content.
- **(c) Review:** public and unlisted apps go through Zoom's app review. Zoom's developer forum says the submission response time is 5 business days (Oct 2026). Apps meant for one company or one account need no review (Zoom distribution docs, snippet). Listing cost: not verified.

### Google Meet add-ons
- **(a) Surface:** the Meet add-ons SDK for Web (generally available since 11 Sep 2024) embeds your app in Meet as an iframe, on the main stage or in a side panel (Google Workspace Updates; Meet add-on docs, snippet). Apps are registered in the Google Workspace Marketplace.
- **(b) Ticket integration:** none native.
- **(c) Review:** not verified.

### Plane (open source)
- **(a) Surface:** no iframe marketplace found. Plane apps use OAuth bearer tokens (Plane developer docs).
- **(b) API and estimate:** REST at https://api.plane.so/api/v1/ or self-hosted. Auth is an X-API-Key header; OAuth bearer tokens for Plane apps. Estimates are estimate points (v2 API: /api/v2/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/points/). Rate limit 60 requests per minute per key (secondary docs.rs, medium).
- **(c) Cost:** self-hosted is open source; Cloud pricing not verified.

### OpenProject and Taiga
- Not verified. I did not open their API references in this run, so the auth model, estimate field and listing rules are unknown. Treat them as CSV-only until checked.

## 4. Generic paths (cover many tools at once)

- **Pasted keys or URLs:** no auth and no review. A pasted key gives an external reference (provider, key, URL), but a title needs a token, so the room may show only keys unless the user pastes titles too. Asana's lookup field works the same way inside Asana.
- **CSV import and export:** the most common pattern in this market. PlanningPoker.com offers Jira import and export. Point Poker says: export the agreed points as CSV and bulk-update Jira from the file (vendor page, medium). Kollabe lists CSV import from Jira, Trello and GitHub (vendor page, low). Zero auth, zero review, and it covers any tracker that exports CSV, including Data Center and Shortcut.
- **Browser extension:** can read the DOM of a logged-in tracker, so no token leaves the user's session. Costs: a Chrome Web Store listing and review (fee and turnaround not verified here) and constant breakage when the DOM changes.
- **Bookmarklet:** no store and no review. It runs in the page context, so the page's CSP can block it on some sites (knowledge-based, not verified here). It can extract the issue key, title and estimate from the open page and hand them to the room through a URL fragment. Install is drag-to-bookmarks, which is friction.
- **Outgoing webhooks to Zapier, Make or n8n:** the room posts a signed event when an estimate is agreed. The automation tool then writes to the tracker with the user's own account, so the maintainer stores no tracker secret. Costs: Zapier free tier is 100 tasks per month with two-step zaps and 15-minute polling; instant triggers are a paid feature (parseur, stepper, secondary, medium). Make free: 1,000 credits per month (parseur, secondary). n8n Community Edition is free and unlimited when self-hosted (parseur, secondary).
- **Unified APIs:** Merge Launch is free for 3 linked accounts, then $650 a month for up to 10 and $65 each beyond that (unified.to comparison, competitor-written, low; Reverbico, secondary, says Launch from $650 a month). Unified.to bills per API call with unlimited connections: Grow is $750 a month for 750,000 requests and Scale is $3,000 for 6 million (Apideck, competitor-written, low). Both assume a linked account per end user, which conflicts with a no-account design and costs far more than a free tool can carry.

## 5. Coverage per effort for a solo maintainer with no accounts

- **Best:** CSV in and out, pasted keys, and a signed outgoing webhook. Coverage is every tracker that can export CSV or accept a webhook consumer, no secret, no review, and only a few days of work. The main cost is the manual import step for the user.
- **Second:** frame-ready SPA plus Trello Power-Up, Teams tab, Zoom app and Meet add-on. Trello and Azure DevOps give ticket context from the host. Teams, Zoom and Meet give only a room and need the same frame headers. Each adds a review, but none needs a server secret.
- **Third:** Azure DevOps web extension. Good usage among enterprise teams, with host context, but it needs Entra OAuth or a user token. Keep any secret out of the room server.
- **Fourth:** Jira Forge app. Largest usage, but the highest effort, and it is not a frame for an external page.
- **Last:** Linear, GitHub, GitLab, ClickUp, Asana, monday, Shortcut, YouTrack, Notion, Plane. Build native write-back only when users ask, because each adds an OAuth secret or a token-handling path.
- **Not worth it:** Unified APIs, given the per-linked-account billing and the account model they assume.

## 6. Prioritized order

1. CSV import and export, pasted keys and URLs, estimate CSV export. Ships first.
2. Signed outgoing webhook on agreed estimate, with Zapier, Make and n8n recipes.
3. Frame-ready route for /room/<slug> (frame-ancestors for the listed hosts, no cookie dependence). Then Trello Power-Up with the iframe connector (card context from t.card), and the Teams tab and Zoom app as room-only surfaces. Add Meet after Zoom.
4. Azure DevOps web extension (hub, host context, token in the browser or Entra OAuth).
5. Jira Forge app, after the Azure path proves the write-back contract.
6. Native Linear and GitHub write-back, then ClickUp, Asana, monday, Shortcut, YouTrack, Plane. Build only on demand, and only if the secret policy below holds.
7. Miro, Notion, Slack, Confluence and the open-source trackers (OpenProject, Taiga) last, or never.

## 7. Recommendation

Build the generic CSV, paste and webhook paths first, then make the SPA frame-ready and add the Trello and Teams surfaces. This gives the widest coverage for the least risk: no accounts, no stored secrets, and small review burdens.

**Main tradeoffs.** Room-only surfaces (Teams, Zoom, Meet) look impressive but add no ticket data; they only pay off with a paste or CSV path behind them. Trello and Azure DevOps give real context but are narrower in audience than Jira. Native OAuth write-back is the step that forces a server secret and a token store, so defer it. Reviews take days to weeks (Zoom 5 business days, Miro 8 to 12 weeks by secondary sources), so the Marketplace calendar should not block the room's launch.

## 8. Decide now, because these cannot be retrofitted cheaply

1. **Frame contract.** Set frame-ancestors on /room/* only, with an explicit allowlist of host origins. Decide that the room must work inside a third-party iframe with no cookies. Seat identity must survive in-iframe storage or be carried in the URL. Changing the room URL scheme or identity model later breaks every embed.
2. **Host bridge outside the reducer.** Host messages (postMessage, the Trello connector, the Teams, Zoom, Meet and Azure SDKs) enter through an adapter layer that turns host context into reducer commands. The reducer stays host-agnostic, which keeps the property tests and the simulator clean.
3. **Estimate value type.** Decide one canonical type in the Zod 4 frame schema: a deck value with an optional numeric mapping. Trackers use integers (Linear, GitLab weight, Shortcut), decimals or Fibonacci numbers (Jira, Azure), and text such as t-shirt sizes (many decks). Choosing a numeric mapping now avoids a schema migration later.
4. **External reference model.** Use an opaque reference { provider, key, url, title? } with no provider-specific fields in the reducer. This keeps the Jira key format (PROJ-123) separate from GitHub and GitLab IDs.
5. **Secret policy.** Decide now that the room server never stores provider tokens, OAuth client secrets or Entra secrets. Tokens stay in the browser and are used per request, with a stateless proxy only if CORS requires one. Removing a token store later is painful.
6. **Write-back event.** Add an 'estimate agreed' outgoing event with a source, a target reference and a sync status to the event log and the webhook schema. Its shape feeds the simulator and property tests, so it is hard to change once they depend on it.
7. **Privacy and telemetry.** Ticket titles pasted into a room become room state. Decide the retention and whether titles can appear in OpenTelemetry or Umami events. Recommend: never log titles or keys, and keep both out of ClickStack and Umami.

## 9. Uncertainties

- The Jira usage figure is from a 2024 benchmark reported second-hand; the 2025 Digital.ai report was not opened.
- Usage order beyond Jira is unverified.
- Forge's external-page constraint is inferred from the Custom UI and permissions docs, not from a test.
- Browser-to-tracker CORS was not checked for any tracker. It decides whether the no-secret path works without a proxy.
- Review times and listing costs for Teams, Zoom, Meet, Trello, Azure DevOps, Miro (except the secondary figures), Asana, monday and Notion are not verified.
- OpenProject, Taiga and Jira Data Center were not researched.

## Not verified

- Jira Data Center app model (Connect or Forge on DC) and whether an external page can be framed: Not researched in this run.
- Browser-to-tracker CORS for personal-token calls (Jira, Linear, ClickUp, Asana, monday, Trello, Shortcut, Plane): Not checked per tracker; decides whether a no-proxy, no-secret design works.
- Whether Forge Custom UI can frame an arbitrary remote page; Forge external fetch rules and CSP frame-src: Egress page read returned mostly navigation; the frame-src rule was not confirmed. Inferred from permissions reference (medium).
- Usage share beyond Jira (Azure DevOps, GitHub, GitLab, Linear, ClickUp, Asana, monday, Trello, Shortcut, YouTrack, Notion, Confluence, Teams, Slack, Zoom, Meet): No public survey share found in sources read; order after Jira is judgement.
- Digital.ai 18th State of Agile Report primary figures (Jira 62%, Mural or Miro 32%): Taken from secondary aggregators; primary report not opened.
- Listing cost and review time for Trello Power-Up, Teams Store, Zoom (cost), Google Workspace Marketplace (Meet), Asana, monday, Notion public integrations, Slack App Directory, GitHub Marketplace, Visual Studio Marketplace: Not verified; only process steps seen in snippets.
- Azure DevOps Agile story-points field name (Microsoft.VSTS.Scheduling.StoryPoints) and work item write path: Expected from knowledge; not read on a primary page in this run.
- Linear estimate field name and write mutation: Not read in this run.
- GitHub Projects and Issues: absence of any third-party iframe surface: Negative claim with no source that states it.
- Slack: absence of any third-party iframe surface: Surfaces list read via snippet; full list not confirmed.
- Notion: whether a room URL can be embedded through the embed allowlist: 2021 help page; current allowlist not checked.
- OpenProject: API v3 auth, estimate field, listing rules: Not researched in this run.
- Taiga: API auth, points field, listing rules: Not researched in this run.
- Chrome Web Store fee and review time for a browser extension: Not researched in this run.
- Current Make, Zapier and n8n tier limits and instant-webhook availability: Secondary comparison pages with differing figures; not checked on vendor pricing pages.
- Trello Power-Up review turnaround and whether free apps are accepted: Submission page exists in navigation; contents not read.

## Sources

- https://developer.atlassian.com/platform/forge/add-content-security-and-egress-controls/
- https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
- https://developer.atlassian.com/platform/forge/extend-ui-with-custom-options/
- https://developer.atlassian.com/platform/marketplace/listing-forge-successor-to-connect-apps/
- https://www.atlassian.com/blog/development/getting-ready-for-connect-end-of-support
- https://developer.atlassian.com/cloud/jira/platform/cacheable-app-iframes-for-connect-apps/
- https://alpstack.com/product-launch-sites/atlassian-marketplace
- https://community.developer.atlassian.com/t/2-things-that-tripped-me-up-shipping-a-forge-app-in-2026-a-checklist-for-connect-forge-movers/104092
- https://github.com/bobmatnyc/mcp-ticketer/blob/main/skills/platforms-jira-api/SKILL.md
- https://support.atlassian.com/jira/kb/how-to-migrate-original-story-points-in-jira-data-center/
- https://developer.atlassian.com/cloud/trello/guides/power-ups/building-a-power-up-part-one/
- https://github.com/brittanyjoiner15/trello-powerup-starter/blob/main/docs/powerup-reference.md
- https://learn.microsoft.com/en-us/vsts/integrate/get-started/authentication/oauth
- https://learn.microsoft.com/en-us/questions/6025099/exact-end-of-life-dates-for-azure-devops-oauth-and
- https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops
- https://www.grizzlypeaksoftware.com/library/building-custom-azure-devops-extensions-aacu3biw
- https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/tab-requirements
- https://learn.microsoft.com/fil-ph/microsoftteams/platform/concepts/deploy-and-publish/appsource/publish
- https://developers.zoom.us/blog/introducing-zoom-apps/
- https://developers.zoom.us/docs/distribute/
- https://devforum.zoom.us/t/important-update-to-our-app-review-submission-response-time/147049
- https://developers.google.com/workspace/meet/add-ons/guides/overview
- https://workspaceupdates.googleblog.com/2024/09/google-meet-add-ons-sdk-is-now-available.html?m=0&hl=en_GB
- https://rationalgo.ai/resources/app-builder/platforms/build-a-miro-app-with-ai
- https://alpstack.com/product-launch-sites/miro-marketplace
- https://developers.miro.com/docs/get-ready-for-marketplace
- https://docs.slack.dev/surfaces/
- https://developers.asana.com/docs/app-components-on-tasks
- https://developers.asana.com/reference/searchtasksforworkspace
- https://developer.monday.com/apps/docs/intro
- https://monday.com/w/app-developers
- https://www.taskrhino.ca/monday-com/custom-integrations/
- https://linear.app/developers/rate-limiting
- https://throttle.com/api-limits/linear/
- https://github.com/0xvasanth/gespan/issues/49
- https://developer.clickup.com/reference/setcustomfieldvalue
- https://developer.clickup.com/docs/customfields.md
- https://github.com/TerminalSkills/skills/blob/main/skills/clickup/SKILL.md
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- https://docs.gitlab.com/api/issues/
- https://docs.gitlab.com/api/rest/authentication/
- https://www.jetbrains.com/help/youtrack/devportal/youtrack-rest-api.html
- https://www.jetbrains.com/ko-kr/help/youtrack/devportal/apps-faq.html
- https://developers.notion.com/.well-known/agent-skills/notion/skill.md
- https://developers.notion.com/guides/connections-and-tokens/public-integrations/overview
- https://www.notion.com/help/embed-and-connect-other-apps?slug=embed-and-connect-other-apps
- https://developers.plane.so/llms.txt
- https://developers.plane.so/api-reference/v2/estimate-points/create-estimate-point
- https://docs.rs/crate/plane-cli-requiem/latest/source/docs/plane-api-reference.md
- https://jentic.com/apis/clubhouse.io/clubhouse
- https://1337skills.com/cheatsheets/shortcut/
- https://www.breeze.pm/articles/agile-statistics
- https://xtendedview.com/agile-statistics/
- https://www.teamretro.com/blog/best-planning-poker-tools-for-agile-teams/
- https://www.pointpoker.app/planning-poker-jira
- https://kollabe.com/planning-poker
- https://parseur.com/blog/zapier-n8n-make
- https://stepper.io/automation/make-vs-n8n-vs-zapier/
- https://unified.to/blog/merge_vs_unified_which_unified_api_should_you_choose_in_2026.md
- https://reverbico.com/blog/top-unified-api-platforms/
- https://www.apideck.com/blog/unified-to-alternatives
- https://developers.miro.com/docs/miro-marketplace
- https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops
