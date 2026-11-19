# Embedding, webhooks and tracker integrations

Research run of 2026-11-19 (`agw research`, depth deep). Run status: ok. Citations grounded against fetched pages: 54/55. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Atlassian (Jira):** Yes, a Forge Custom UI app or UI Kit Frame can host an external SPA in an iframe, but only if the manifest declares that origin under `permissions.external.frames` (frame-src) and the API and WebSocket origins under `permissions.external.fetch.client` (connect-src). Atlassian's docs describe the Events API for Frame-to-app messaging and do not document a raw postMessage contract with a nested external iframe, so treat that link as a spike. Atlassian Connect ends support on 31 January 2027, so do not build on Connect. Story points are a per-site custom field whose ID you must resolve at runtime. A third-party 3LO app is possible, but Atlassian says apps that make customers create their own 3LO apps, or that collect API tokens, do not comply with its security requirements. For a free tool that means one distributable 3LO app, or no Atlassian credentials at all via Forge.
- **Linear:** No iframe or app-embed surface was found in the Linear docs read. Writing estimates needs OAuth (or a personal key). Estimate scales are a team setting with five API enum values: notUsed, exponential, fibonacci, linear, tShirt. Linear's integration directory states it generally does not accept scripts, low-effort or vibe-coded apps, or apps built by hobbyists, which matters for a solo project.
- **GitHub:** Issues have no estimate field in the sources read. Estimates go in a Projects v2 number field, set with `updateProjectV2ItemFieldValue`.
- **Outgoing webhooks:** Use Standard Webhooks v1.0.0 (headers `webhook-id`, `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 over `id.timestamp.payload`). Slack incoming webhooks take a message (`text`, `blocks`), not arbitrary event JSON, so each destination needs its own formatter. Microsoft Teams Office 365 Connectors were retired in May 2026; the replacement is Workflows webhooks, which take Adaptive Cards or MessageCard payloads.
- **Browser storage (2026):** All five major browsers partition third-party localStorage and IndexedDB by top-level site. Safari also resets partitioned localStorage between app launches. An anonymous seat token kept in localStorage inside an embedded room is therefore not a durable identity. The server should issue a reclaimable seat secret and treat localStorage as a cache.
- **Recommendation:** Keep zero third-party credentials in the room core. For Jira, let Forge hold the Atlassian tokens and do the write-back inside Forge. Send other integrations through signed outbound webhooks to URLs the user controls, and Slack or Teams incoming-webhook URLs (secrets, encrypted at rest). Defer Linear, GitHub and Azure DevOps OAuth until there is demand. Design the data model and protocol items in section 7 now.

## 1. Atlassian: Forge, Connect, JQL, story points, 3LO

### Status and end-of-life of Atlassian Connect

Atlassian's timeline for Connect, as published in August 2026 (with an October 2026 clarification on Tier 2 rate limits): intent to end support announced 31 January 2025; end-of-support timeline published March 2025; new Connect apps stopped being accepted on Marketplace in September 2025; Connect apps could no longer receive updates from March 2026; end of support begins 31 January 2027, moved from December 2026 to give holiday and planning time. After that date Atlassian will only address critical security patches, support SLAs are relaxed, Connect will not evolve with the platform, and capabilities can be removed with shorter deprecation windows and less notice. Atlassian says over 95% of paid app seats have moved to Forge. Treat Forge as the only viable target for new Atlassian work.

### Forge: external frames, egress, CSP

The UI Kit Frame component (`import { Frame } from '@forge/react'`) renders a Custom UI resource that is declared in the manifest, referenced by its resource key. It supports bidirectional and broadcast communication with the parent app through the Events API. Limits: one Frame per module; only modules that support Custom UI; Jira custom fields cannot render Frame in view mode. Frame sizing uses px or %.

The manifest controls the rest. The relevant keys, as Atlassian documents them:

- `permissions.external.frames`: the list of external sources allowed in the frame-src policy for Custom UI.
- `permissions.external.fetch.client`: external sources allowed in connect-src. Entries may be https or wss URLs, wildcards such as `*.example.org`, or a generic `*`. A wildcard does not include the parent domain, so list both.
- `permissions.external.fetch.backend`: domains that Forge functions and resolvers may call. Calls to undeclared domains are rejected. Redirects to an external domain must be declared (Atlassian's runtime egress page).
- `permissions.content.scripts` and `permissions.content.styles`: CSP script-src and style-src for Custom UI. Atlassian blocks unsafe policies unless declared. `unsafe-inline` is an opt-in.
- `permissions.external.frames` popups: Atlassian says popups from embedded iframes are blocked by default. Adding `fetch.client` with `*` enables allow-popups and allow-popups-to-escape-sandbox. This is a broad grant.
- `permissions.sandbox`: `allow-storage-access-by-user-activation` lets the app call `document.requestStorageAccess()` after a user gesture.

A manifest fragment for a room embed would look like this (domain names are placeholders):

```
permissions:
  external:
    frames:
      - https://rooms.example.org/embed
    fetch:
      client:
        - https://rooms.example.org
        - wss://rooms.example.org
      backend:
        - https://rooms.example.org
  content:
    styles:
      - unsafe-inline
```

The `unsafe-inline` style line is optional and only needed if the wrapper uses inline styles. Atlassian warns that using external capabilities may make an app ineligible for Runs on Atlassian, which is checked with the Forge CLI eligibility tool. Declaring analytics egress (for example to a self-hosted analytics endpoint) makes the app ineligible if it carries in-scope end-user data, so do not declare analytics egress for the embed.

What is not verified: Atlassian's docs describe the Frame-to-app Events API, not raw postMessage between the Frame's script and a nested cross-origin iframe. Standard browser postMessage should work inside a permitted iframe, and the room protocol can be built on it, but this needs a spike in a real Jira site before it is relied on. The module keys (`jira:issuePanel`, `jira:issueAction`, `jira:globalPage`) were not re-read in this run.

### Reading issues by JQL and writing story points

- Read: use the enhanced search endpoint `POST /rest/api/3/search/jql` (also `GET`). Atlassian's reference marks the older `/rest/api/3/search` as 'currently being removed'. Classic scope recommended: `read:jira-work`; granular alternative: `read:issue-details:jira`. The exact per-operation scope list for search/jql was not read in full; the reference's 'OAuth scopes required' field is authoritative.
- Forge call shape from Atlassian's sample: `requestJira('/rest/api/3/...', { method: 'POST', headers: {...}, body })` imported from `@forge/bridge`. Forge keeps the Atlassian token, so the app holds no Atlassian secret.
- Story points: a custom field whose ID varies by site. One Atlassian MCP issue shows `customfield_10016` labelled Story Point Estimate, but a third-party plugin resolves it by calling `GET /rest/api/3/field` and matching the name 'Story Points', because the number differs per site. Atlassian support says team-managed spaces have story points and time as estimation statistics. Resolve the field ID per site, cache it, and re-resolve on a 400 error.
- Write: update the field through the issue edit operation. Atlassian's permissions example uses `write:jira-work`. Confirm that operation's 'OAuth scopes required' field before shipping. Declare only `read:jira-work` and `write:jira-work` in `permissions.scopes`.
- The user's permissions always constrain the app: the app cannot edit an issue the user cannot edit, even if the scope is declared.

### What a third-party web app needs for Jira OAuth 2.0 (3LO) instead

1. Create an OAuth 2.0 integration in the Atlassian developer console, enable OAuth 2.0 (3LO), set a callback URL, and add the APIs and scopes you need under Permissions. Only scopes added there can be requested.
2. Send the user to `https://auth.atlassian.com/authorize` with `audience=api.atlassian.com`, `client_id`, a space-separated `scope`, `redirect_uri` (exact match), an unguessable `state` bound to the session, `response_type=code`, and `prompt=consent`.
3. Exchange the code: POST to `https://auth.atlassian.com/oauth/token` as JSON with `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`. The response has `access_token`, `expires_in`, `scope`.
4. Find the site with `GET https://api.atlassian.com/oauth/token/accessible-resources` using the bearer token; use the returned `id` as the cloudid in the request URL.
5. Grant types: account-level (one consent across sites) or resource-level (consent per site).

Costs for you: you store the client secret, a token and refresh path per site, and a re-consent flow. Atlassian's policy says a single distributable 3LO app is the compliant pattern. A tool that tells each customer to create their own 3LO app, or that asks for API tokens, is not compliant. The refresh-token lifetime and `offline_access` behaviour were not read in this run.

## 2. Linear

**Embed surface.** No iframe or app-embed surface was found. The Linear docs reviewed cover OAuth, webhooks, the integration directory and agents, and none describe an embeddable UI. Confidence: medium, since this rests on absence in the pages read.

**OAuth scopes and token lifetimes.** Authorize at `https://linear.app/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, a comma-separated `scope`, a recommended `state`, optional PKCE, and an `actor` of `user` (default) or `app`. Scopes documented: `read` (always present), `write` (broad), `issues:create` ('allows creating and updating issues, creating their attachments, subscribing and unsubscribing'), `comments:create`, `timeSchedule:write`, `admin` (user actor only), `oauth:create`, `customer:read` and `customer:write`, `initiative:read` and `initiative:write`, `customView:read`, `app:mentionable` and `app:assignable` (app actor). For estimate updates, `issues:create` is the narrowest documented scope that covers updating issues. Token exchange: POST `https://api.linear.app/oauth/token`. Authorization-code access tokens last 24 hours; refresh tokens last 30 days and each refresh returns a new pair. Client-credentials tokens last 30 days with no refresh token. A lost refresh response can be recovered by retrying the same refresh token within 30 minutes.

**Estimate scales.** Estimates are a team-level setting (Team Settings > General > Estimates). The Linear Apollo schema lists `issueEstimationType` as one of 'notUsed', 'exponential', 'fibonacci', 'linear', 'tShirt', plus `issueEstimationAllowZero` and `issueEstimationExtended`. Linear's docs table gives the default values: Exponential 1, 2, 4, 8, 16; Fibonacci 1, 2, 3, 5, 8; Linear starts 1 (the table is truncated in the snippet read; `web_ask` states 1 to 5, which was not verified on the page). Linear's 2020 changelog says all scales have five values by design and that extended scales add two more. The specific extended values (for example Exponential 32 and 64, T-shirt XXL and XXXL) came only from `web_ask` and are not verified. T-shirt values need a mapping to numbers for Jira or Azure DevOps.

**Listing issues by team or cycle and setting estimates.** The GraphQL types exist (`Issue`, `Cycle`, `Team`), but the query and mutation argument shapes were not read in this run. Treat this as unverified and read the schema before implementing.

**Webhooks.** Webhooks belong to an organization and can cover all public teams or one team (`webhookCreate` takes `teamId` or `allPublicTeams` and `resourceTypes`). OAuth apps can configure webhook settings and a webhook is created for each authorizing organization. Headers on each POST: `Linear-Delivery` (UUID), `Linear-Event` (e.g. Issue), `Linear-Signature` (hex HMAC-SHA256 of the raw body with the webhook's signing secret), and `Linear-Timestamp` (Unix milliseconds). The body has `action`, `type`, `actor`, `data`, `url`, `updatedFrom`, `webhookTimestamp` (ms) and `webhookId`. Linear recommends checking the timestamp is within a minute. Delivery must be HTTPS, non-localhost, and return HTTP 200 within 5 seconds. A failed delivery is retried 3 times, after 1 minute, 1 hour and 6 hours, and the webhook may be disabled if it stays unresponsive. This is not the Standard Webhooks scheme: the signature is hex, the timestamp is in milliseconds, and there is no `webhook-id` header.

**Agents.** An agent is an OAuth application with the app actor and `app:assignable` or `app:mentionable` scope. Linear's agent docs say that to make an agent available to other workspaces you submit it to the integration directory, and that agent session events are sent as webhook events.

**Integrations directory requirements.** Submit through a form; provide a 320x320 colour and a monochrome icon, and 1 to 3 showcase images at 1600x1000. Linear recommends building with OAuth and a separate workspace that all admins can access. Linear says it will accept integrations 'built by formal companies' and 'generally do not accept scripts, low-effort/vibe coded or apps built by hobbyists'. For a solo free tool, a directory listing is unlikely.

## 3. GitHub Issues and Projects: estimate fields via GraphQL

Issues have no estimate field in the sources read. The estimate lives in a Projects v2 custom field. Per GitHub's GraphQL reference, `updateProjectV2ItemFieldValue` updates the value of a field for an item in a Project and currently supports single-select, multi-select, text, number, date and iteration fields. A number field is the natural estimate type: create a Projects v2 number field named 'Estimate' or 'Story points', look up its field ID and the item ID through the project's GraphQL fields and items, and call the mutation with the number value. The exact input type (`UpdateProjectV2ItemFieldValueInput`) was not read in full in this run. Token scopes and GitHub App versus OAuth App choice were not verified; for a write-back integration a GitHub App is the usual choice, but this was not checked against a GitHub page in this run.

## 4. Outgoing webhooks

### Standard Webhooks (v1.0.0, Apache 2.0)

- Headers: `webhook-id` (unique per event; unchanged across retries; use it as an idempotency key), `webhook-timestamp` (integer Unix seconds, the time of the attempt, not the event), `webhook-signature` (space-delimited list such as `v1,<base64>` to support secret rotation).
- Signed content: `msg_id.timestamp.payload`, with the payload exactly as sent. Symmetric scheme (`v1`): HMAC-SHA256 with the secret base64-decoded after the `whsec_` prefix; the spec requires 24 to 64 random bytes. Asymmetric (`v2a`): ed25519 over the SHA-256 of `endpoint_id.msg_id.timestamp.payload`, with the endpoint ID shared out of band. `v1a` is deprecated. Spec guidance: prefer asymmetric signatures where the sender and receiver are not under one control; with a single operator, symmetric per-endpoint secrets are simpler.
- Verification: constant-time comparison; never re-serialise the parsed JSON before verifying; reject timestamps outside a tolerance window (the spec says 'some allowable tolerance' without a figure); deduplicate on `webhook-id`. The spec's example suggests keeping seen IDs in Redis for about 5 minutes. Linear's tolerance is one minute, and a 5-minute window is a reasonable default.
- Payload: `type` (hierarchical, dot-delimited, e.g. `round.revealed`), `timestamp` (event time, ISO 8601), `data`. Keep payloads under about 20 KB; prefer thin payloads plus a read API where data is sensitive.
- Retry schedule: the spec recommends retries spanning multiple days with exponential backoff and jitter. Its example: immediately, then 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, 14 hours, 20 hours and 24 hours (cumulative about 75.6 hours). Svix's 2027 'State of Webhooks' recommends a schedule that spans at least a day: immediately, then 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, and 10 hours again. For this tool, a 10-attempt schedule spanning about 3 days with jitter fits both. Disable the endpoint after persistent failure and show it in the admin UI, since the room owner may be anonymous and have no email.
- Status handling: 2xx is success; 3xx is failure (do not follow redirects); 410 means disable the endpoint; 429 and 502/504 mean throttle; honour `Retry-After`. Recommended request timeout: 15 to 30 seconds. The spec also recommends manual replay of failed deliveries.

### Transactional outbox in Postgres with FOR UPDATE SKIP LOCKED

- Write the event row in the same transaction as the state change (for example the reveal or the final estimate), so the event exists if and only if the state change committed.
- A relay claims rows with `SELECT ... FOR UPDATE SKIP LOCKED` (PostgreSQL 9.5+). SKIP LOCKED skips rows held by another transaction instead of waiting, so several relay workers do not serialise behind one another. Plain `FOR UPDATE` without SKIP LOCKED makes N workers behave like one (per an ADR on django-reliable-outbox). Secondary sources describe the same pattern (svyatov's job-queue patterns, Prisma's SKIP LOCKED post, EpiFive's outbox article).
- Recommendation (design, not sourced): do not hold a database transaction open across the HTTP call. Claim rows and set a lease (`locked_until = now() + interval`, `attempts = attempts + 1`), commit, send, then update the row only if the lease token still matches. A worker that crashes releases its work when the lease expires.
- Suggested columns: `id` (UUID, becomes `webhook-id` with a `msg_` prefix), `event_type`, `room_id`, `payload` (jsonb), `created_at`, `next_attempt_at`, `attempts`, `status`, `locked_until`, `lease_token`, `delivered_at`, `last_status_code`. A partial index on `next_attempt_at` where `status = pending` keeps the claim query cheap.

### SSRF protection for user-supplied URLs on Bun

- OWASP's cheat sheet separates two cases. Where the target is one of a known set of hosts, use an allowlist. Where users can point the server at any URL, as with webhook callbacks, an allowlist is not available, so layer application checks and network controls. It also says to disable following redirects in the web client to prevent bypasses of input validation, and to resolve and check DNS results.
- Standard Webhooks' SSRF guidance: route webhook requests through a filtering egress proxy such as smokescreen, and place workers in a private subnet with no route to internal services.
- Bun: Bun's fetch docs show that you can connect to an address you resolved and checked yourself by putting the IP in the URL and setting the `Host` header to the origin. This pins the connection to the checked address, which closes the gap between check and connect that DNS rebinding relies on. Whether TLS SNI and certificate checks behave correctly with a pinned IP, and whether Bun follows redirects by default in every fetch path, were not verified in this run.
- Caution from a published guard: the ssrf-guard-js changelog records a release where DNS checks were not run on Bun when DNS pinning was active, so a private address was fetched. The same README says the safe approach is to fail closed if any resolved address is private, to revalidate every redirect hop, and to strip Authorization and Cookie headers on cross-origin redirects. Test your own guard against Bun rather than trusting a library.
- Practical rules (recommendation; the ranges are standard but not sourced here): allow https only (localhost only in development); reject URLs with credentials; allow ports 443 (and optionally 80 for testing) only; resolve every A and AAAA record and reject if any is private, loopback, link-local (169.254.0.0/16 covers cloud metadata), CGNAT (100.64.0.0/10), unique-local (fc00::/7), link-local IPv6 (fe80::/10), or an IPv4-mapped IPv6 address that maps to one of these. Pin to the checked IP. Refuse redirects: a 3xx counts as failure, as the Standard Webhooks spec recommends.

### Can Slack and Microsoft Teams incoming webhooks take a generic JSON payload?

**Slack: no.** A Slack incoming webhook takes a JSON message: a `text` field and optional `blocks` (Block Kit). Channel, username and icon come from the Slack app and cannot be overridden per message. A generic event envelope is not a Slack message, so you need a Slack formatter that renders text and blocks. The webhook URL is a secret; Slack says it actively searches for and revokes leaked URLs.

**Microsoft Teams: no.** Office 365 Connectors, including connector-based incoming webhooks, were retired in May 2026. Rollout ran from 18 to 22 May 2026. Microsoft's replacement is Workflows-app webhooks. These accept Adaptive Cards, and Microsoft's February 2026 update added MessageCard-formatted payloads for migrating connectors. Limits: MessageCard payloads do not render HttpPost action buttons; the bot icon and name cannot be customised for Adaptive Card payloads; posting to private channels has been rolling out. So each destination type needs its own formatter: `slack` (text and blocks), `teams-workflows` (Adaptive Card), and `generic` (Standard Webhooks, signed JSON).

## 5. Browser storage partitioning in 2026

- **Chrome (and Edge):** third-party frames have partitioned storage, service workers and communication APIs by top-level site, rolled out gradually from Chrome 115 (2023). The HTTP cache has been partitioned since Chrome 86 (2020). Google's Privacy Sandbox page says storage partitioning is enabled for all users. Chrome has decided to keep its current approach to third-party cookies and withdrew some Privacy Sandbox features (MDN's Shared Storage page, 2026). Partitioning is not being reversed.
- **Firefox:** Total Cookie Protection has been on by default for all users since 14 June 2022. localStorage and IndexedDB are partitioned between a site and each third party; sessionStorage is not restricted. Firefox 85 partitioned network state including the HTTP cache.
- **Safari:** third-party localStorage is partitioned and reset between application launches; third-party IndexedDB is partitioned and cleared when Safari quits; sessionStorage is partitioned.
- **Brave:** ephemeral partitioning, cleared when the user leaves the site.
- Cookie Status (updated 31 October 2026) summarises that all five browsers now partition this storage by top-level site by default. An iframe from b.example on a.example gets different storage from the same iframe on c.example.
- **Storage Access API:** `document.requestStorageAccess()` lets cross-site content in an iframe request access to third-party cookies and unpartitioned state after a user gesture, and `document.hasStorageAccess()` reports the status. Browsers can refuse. It does not make localStorage unpartitioned for all purposes. Forge's sandbox directive `allow-storage-access-by-user-activation` opts a Forge Custom UI iframe in.

**What it means for an anonymous seat token in localStorage inside an embedded room.**

- A token written inside a Jira-embedded room lives in the partition of (Jira site, room origin). The same person opening the room directly on the room's own site gets a different partition and a different token, so they appear as two seats.
- Safari resets partitioned localStorage between launches, so the seat can disappear every time the user relaunches Safari. In a room of 2 to 30 people this produces duplicate or orphaned seats and lost votes.
- Third-party cookies set from the iframe are also partitioned or blocked, so cookies are not a reliable fallback in the embed.
- Design consequence: the server issues a seat identity (a seat ID and a secret) on first join. The browser keeps the secret as a cache. A user who loses it can reclaim the seat with a reclaim code shown in the room or by re-entering the room link and naming the seat. The client-generated ID alone must not be an authenticator. Admin rights must never rest on localStorage.

## 6. How existing planning poker products integrate with Jira, Linear, Azure DevOps and GitHub

- **TeamRetro (free browser planning poker):** imports items from Jira, Azure DevOps, GitHub, Linear or its own backlog, runs independent votes with a reveal, and syncs agreed estimates back to Jira, Azure DevOps, GitHub and Linear. It also offers a REST API, webhooks and MCP. The page does not say whether the Jira connection is an app or OAuth. It also claims a SOC 2 Type 2 report.
- **Kollabe:** imports Jira tickets into a session and writes the winning vote back to Jira when the round is revealed (Kollabe's Jira page, April 2026).
- **Agile Poker for Jira (Appfire):** saves the agreed value to a designated Jira custom field called the estimation field; estimating is blocked unless the field is configured and valid for the project (Appfire's Confluence page, August 2026).
- **Planning Poker – Live & Async Estimation for Jira (Atlassian Marketplace):** saves the agreed story points to the work item, live or async.
- **Azure DevOps:** a Planning Poker extension for Azure Boards is listed as 'now unpublished from Marketplace'. The Story Points field in the Agile process has reference name `Microsoft.VSTS.Scheduling.StoryPoints`. Work items are updated with `PATCH https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{id}?api-version=7.1` using `application/json-patch+json`; Microsoft's create-operation page lists `vso.work_write` for read, create and update of work items (an older API version page).
- **Liatrio planning-poker (open source, January 2025):** real-time poker with Jira and Azure DevOps integration, built with React, Node.js, WebSocket and PostgreSQL. A useful reference implementation.
- **Pattern:** Atlassian-native poker apps use Forge or Marketplace apps and write to a configured field. Cross-tool products (TeamRetro, Kollabe) use account connections (OAuth or an app) and write back on reveal or on confirmation. A browser extension was not found in these results. No product in the set was seen to write Linear or GitHub estimates through an iframe.

## 7. Recommended architecture and what must be designed now

### Architecture (fewest third-party credentials)

1. **Room core (Bun, Elysia, Postgres):** holds rooms, seats, topics, rounds, server-side votes (hidden until reveal), final estimates, external references and the outbox. It holds no Atlassian, Linear, GitHub or Azure DevOps credentials.
2. **Jira:** a small Forge app that embeds the room with `permissions.external.frames` and `fetch.client` (both https and wss), and does the story-point write-back inside Forge with `requestJira`. Atlassian holds the Jira tokens, so the room never sees them. Costs: an Atlassian developer account, a Forge app to maintain, and Runs on Atlassian eligibility rules. Connect is excluded by the 31 January 2027 end of support. A 3LO app is the fallback; it means storing a client secret and per-site tokens and refreshing them, and Atlassian's policy requires one distributable app.
3. **Other destinations:** signed outbound webhooks (Standard Webhooks) to URLs the user controls. Slack and Teams incoming-webhook URLs are stored encrypted, with a formatter for each type. Those URLs are credentials you hold, so keep them minimal and encrypted.
4. **Linear, GitHub, Azure DevOps:** no OAuth in version 1. Offer paste-link import and outbound webhooks that a user's own automation can use to write back. Add OAuth per tracker once there is demand. Linear's directory policy makes a listing unlikely for a hobby project.

### Tradeoffs

- Forge minimises stored credentials and handles Atlassian auth, at the cost of platform lock-in and unverified postMessage behaviour. Forge pricing, quotas and hosting limits were not checked in this run.
- An embed that is not Forge (a plain iframe on Atlassian sites) avoids Forge but must handle Jira auth itself. Restrict framing with your own `frame-ancestors` CSP to Atlassian origins. That control was not read from a source here.
- Server-issued seat secrets add a reclaim flow, but they are required by storage partitioning.
- Symmetric per-endpoint webhook secrets are simpler than asymmetric signing and are adequate when the operator is the only sender.

### Must be designed now (cannot be retrofitted cheaply)

1. **Issue reference (`external_ref`):** provider, stable ID (Jira issue ID, not only the key; Linear issue UUID; GitHub node ID; Azure DevOps work item ID), display key (PROJ-123 changes when issues move), site or workspace ID (Jira cloudId, Linear organization, GitHub owner and project number, ADO organization and project), URL and a title snapshot with a fetched-at time.
2. **Topic:** free text plus an optional `external_ref`; ordered within a room; each topic owns its rounds.
3. **Final estimate:** `scale` (notUsed, exponential, fibonacci, linear, tShirt, custom, matching Linear's enum plus a custom option), a canonical `value` as text (e.g. '5', 'XL', '1/2'), a nullable numeric `points` (for T-shirt sizes, a mapping table value), `decided_by` (consensus, admin, average), `decided_at`, and `round_id`. Store the scale used, since Linear, Jira and Azure DevOps interpret numbers differently.
4. **Rounds and votes:** kept per round with the revealed state; votes are server-authoritative; allow special values (abstain, '?', coffee). Hidden votes are never sent to the client before reveal.
5. **Webhook events:** hierarchical names (`room.created`, `round.started`, `round.revealed`, `topic.estimated`, `room.closed`); event ID as `webhook-id`; payload with a `schema_version`; the final-estimate event carries `external_ref` and the final value only, not individual votes.
6. **Outbox and delivery attempts:** the columns listed in section 4; delivery history kept for replay.
7. **Embed message protocol:** versioned envelope `{v, type, id, payload}`; a strict origin allowlist on both sides; explicit `targetOrigin` on every postMessage; a handshake where the host sends `init` (external reference, locale, theme, display name) and the room replies `ready` with its capabilities; no secrets in messages; unknown types ignored; an `estimate.final` message out.
8. **Room admin capability:** a separate unguessable secret, stored as a hash, distinct from the seat secret; rotation; the creator gets it; admin can reveal, reset, close, edit topics and pass the role on. Keep it out of localStorage as the only copy.
9. **Optional room password:** hashed with a slow KDF (Argon2id or scrypt), separate from the admin capability, with rate limiting; the password is never placed in a URL; a join token is issued after a correct password.
10. **Seat identity:** a server-issued seat ID and secret with a reclaim path (section 5).
11. **Tenant key:** a `source` field on rooms (for example the Jira cloudId) so integrations cannot read across tenants.
12. **Privacy:** no personal data beyond a display name; a retention policy for votes and webhook payloads; payload minimisation for outbound webhooks.

### Open and unverified

See the `unverified` list. The main open items are the Linear issue and estimate GraphQL shapes, the Forge postMessage path inside an embed, the Jira edit-issue scope list, the Bun pinned-IP and redirect behaviour, the Teams Workflows payload schema, and Forge pricing and eligibility.

## Not verified

- Linear GraphQL: listing issues by team or cycle and setting an issue estimate (argument shapes and mutation name): Only the Team type's estimation fields were seen; the Issue query and update mutation were not read. Read the Linear schema before implementing.
- Linear extended estimate values per scale (for example Exponential 32 and 64, Fibonacci 13 and 21, Linear 6 and 7, T-shirt XXL and XXXL): Only given by web_ask, which is unverified; the Linear docs page read did not show the extended values. Default Linear values are also partly truncated in the snippet read.
- Linear estimate default values for the Linear scale (1 to 5): The docs snippet was truncated after Linear|1|; the 1 to 5 range came only from web_ask.
- Forge raw postMessage between the Forge Frame and a nested cross-origin external iframe: Atlassian documents the Events API for Frame-to-app communication, not raw postMessage to a nested external iframe. Needs a spike in a Jira site.
- Forge Jira module keys for issue panel, issue action and global page, and their Custom UI support: Only the issue context page snippet was seen in this run; module pages were not read in full.
- Jira edit-issue REST operation scope list (write:jira-work or granular equivalent) and the search/jql per-operation scope list: The Forge permissions example uses write:jira-work, but the operation's own 'OAuth scopes required' field was not read. Granular scopes for search/jql were not read in full.
- Jira 3LO refresh tokens and the offline_access scope: The 3LO page was truncated before the refresh-token section; refresh token lifetime was not read.
- GitHub Projects v2 mutation input shape (UpdateProjectV2ItemFieldValueInput) and token type for write-back (GitHub App versus OAuth App): Only the mutation summary snippet was read; the input fields and token guidance were not read in full.
- Bun fetch behaviour: TLS SNI and certificate checks with a pinned IP in the URL, and whether redirects are followed by default: Only a search snippet of the Bun fetch page was seen. Behaviour was not tested or read in full.
- Microsoft Teams Workflows webhook exact payload schema (Adaptive Card envelope) and whether it rejects non-card JSON: Only the retirement and replacement notice was read; the Workflows payload format was not read in full.
- Slack incoming webhook behaviour with unknown top-level JSON fields: The doc covers text and blocks; behaviour for unrecognised fields was not stated in the portion read.
- Forge pricing, quotas, hosting limits and Runs on Atlassian eligibility for a free app: Eligibility rules were referenced but not read in full; pricing and quotas were not checked in this run.
- Linear: whether an iframe or app-embed surface exists: Absence of evidence in the Linear docs read; no page explicitly states that embedding is unsupported.
- Linear webhook signing-secret verification code (full example after truncation) and Linear's recommended tolerance: The verification example was truncated; the one-minute recommendation was read in the prose.
- Standard Webhooks timestamp tolerance value: The spec requires an allowable tolerance but does not fix a number; the 5-minute default in this report is a recommendation, not a sourced figure.
- Postgres SKIP LOCKED official manual page: Behaviour is sourced from secondary articles and an ADR, not from the PostgreSQL manual, which was not read.
- Chrome 2026 Storage Access API prompt behaviour and whether Chrome grants it for embedded Jira contexts: The MDN overview was seen as a snippet; browser prompt and grant behaviour was not read or tested.
- Azure DevOps write-back scope for work item update on the current API version: The scope came from an older API version page (6.0), not the current 7.1 reference.
- Planning poker products: whether TeamRetro's Jira connection is an app or OAuth: The page does not state the connection mechanism; integration docs were not read.
- Azure DevOps work items are updated with PATCH https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{id}?api-version=7.1.: cited, but the page was never retrieved this run

## Sources

- https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
- https://developer.atlassian.com/platform/forge/ui-kit/components/frame/
- https://www.atlassian.com/blog/development/getting-ready-for-connect-end-of-support
- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
- https://linear.app/docs/issue-property
- https://linear.app/developers/oauth-2-0-authentication
- https://linear.app/developers/webhooks
- https://linear.app/developers/integration-directory
- https://linear.app/changelog/page/22
- https://studio.apollographql.com/public/Linear-API/variant/current/schema/reference/objects/Team
- https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- https://www.cookiestatus.com/features/other-third-party-storage/
- https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/
- https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- https://www.teamretro.com/estimations/
- https://linear.app/docs/estimates?_rsc=1tyb7
- https://developer.atlassian.com/platform/app-migration/tutorials/adopting-connect-on-forge/
- https://developer.atlassian.com/platform/forge/runtime-egress-permissions/
- https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-context/
- https://developer.atlassian.com/platform/adopting-forge-from-connect/connect-end-of-support-private-apps/
- https://support.atlassian.com/jira-software-cloud/docs/enable-estimation
- https://github.com/atlassian/atlassian-mcp-server/issues/119
- https://github.com/rios0rios0/backstage-plugin-code-health/blob/main/plugins/code-health-backend/docs/jira.md
- https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/
- https://linear.app/developers/agents
- https://docs.github.com/en/graphql/reference/projects
- https://www.svix.com/state-of-webhooks-2027.pdf
- https://database-transactions.svyatov.com/postgres/05-patterns/job-queue
- https://www.epifive.com/blog/transactional-outbox-pattern-reliable-events
- https://github.com/CtrlAltDevelop/django-reliable-outbox/blob/main/docs/adr/0001-skip-locked-over-advisory-locks.md
- https://www.prisma.io/blog/you-dont-need-a-job-queue-postgres-already-has-skip-locked
- https://bun.com/docs/runtime/networking/fetch
- https://github.com/devslab-kr/ssrf-guard-js/blob/main/README.md
- https://github.com/devslab-kr/ssrf-guard-js/blob/main/CHANGELOG.md
- https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
- https://privacysandbox.google.com/cookies/storage-partitioning
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API
- https://developer.mozilla.org/en-US/docs/Web/API/Shared_Storage_API
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning
- https://kollabe.com/posts/planning-poker-with-jira
- https://appfire.atlassian.net/wiki/spaces/JPP/pages/148570249/Company-managed+projects
- https://marketplace.atlassian.com/apps/3468761788/planning-poker-live-async-estimation-for-jira?hosting=cloud&tab=overview
- https://marketplace.visualstudio.com/items?itemName=xware.planning-poker
- https://learn.microsoft.com/en-us/azure/devops/boards/queries/query-numeric?view=azure-devops
- https://learn.microsoft.com/nl-nl/rest/api/azure/devops/wit/work-items/create?view=azure-devops-server-rest-6.0
- https://github.com/liatrio/planning-poker
- https://linear.app/docs/estimates
- https://linear.app/docs/issue-properties-home
