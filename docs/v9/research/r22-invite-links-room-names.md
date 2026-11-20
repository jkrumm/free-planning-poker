# Access codes in invite links, and reusing room names

Research run of 2026-11-20 (`agw research`, depth standard). Run status: partial. Citations grounded against fetched pages: 16/19. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Precedent:** Zoom embeds an encrypted passcode in the invite link so participants can join in one click. Excalidraw keeps the room id and the key together in the URL fragment (`#json=<id>,<key>`). I did not read current behaviour for Google Meet, Whereby, Jitsi, Kahoot, PrivateBin, tldraw or Figma, so those stay open.
- **Placement:** put the code in the fragment (`/room/<slug>#<code>`), never in the path or query. Browsers do not send the fragment in HTTP requests, so it stays out of server logs and Referer headers. Page scripts can still read it, and so can a link scanner that runs JavaScript. Join only after an explicit click.
- **Guidance:** a 3-word code drawn from the 7,776-word EFF list carries about 38.8 bits. A 4-digit PIN carries about 13.3 bits. Guess limits must be per room, not only per IP.
- **Names:** a 2-word slug gives 60,466,176 names and a 3-word slug gives 470,184,984,576. Enforce uniqueness with a database constraint and retry on conflict. Keep closed rooms as tombstones (410), because tombstones use up name space.

## 1. Precedent and UX

**Zoom.** Zoom's support article says the meeting passcode is 'encrypted and included in your invite link to allow participants to join with just one click and avoid having to manually enter a passcode' [1]. Zoom's developer forum confirms the join URL can carry the passcode [2]. Dartmouth's IT pages describe the same behaviour: the default passcode is embedded in the meeting link [3]. The lesson is that the code is hidden from people who click the link and visible to people who type it.

**Jitsi.** Issue #5902 asks for a simple shared room password that can travel in the link, citing Zoom's pattern [4]. It is a feature request, not a shipped behaviour, so I treat it only as evidence that the pattern is wanted.

**Excalidraw.** Secondary sources say the room id and the AES key sit in the fragment (`excalidraw.com/#json=<id>,<key>`), and that the key never reaches the server [5][6]. I did not read Excalidraw's own source, so this rests on secondary reports.

**Open:** Google Meet, Whereby, Jitsi's current room-password flow, Kahoot PINs, PrivateBin, tldraw and Figma were not read. Their current behaviour is listed under `unverified`.

**UX implication for a planning-poker app:** show the code twice, once as the link and once as text with a copy button. People who paste only the room name can then type the code, and the link itself carries the code for everyone else.

## 2. Where the code can live

- **Path** (`/room/<slug>/<code>`): sent to the server and written to access logs. The W3C TAG notes that URLs 'appear in plain text within application logs, such as within web servers and in browser history' [7]. Link-preview fetchers would also request the code-bearing path.
- **Query** (`?code=`): the same exposure as the path, plus analytics scripts that record the page URL. The W3C TAG notes that third-party scripts on a page can read its URL [7].
- **Fragment** (`#<code>`): not sent in the HTTP request, so it stays out of server and CDN logs and out of Referer headers. The W3C TAG recommends fragment-held keys for this reason, but adds that third-party scripts on the page still see the full URL, and that fragments can no longer be used for in-page anchors [7]. SnapPwd makes the same point for one-time links: a scanner that loads the URL in a browser and runs JavaScript can still reach the fragment, so the app should not reveal or consume on page load [8].
- **Implication for the server (my inference):** the code reaches the server only when the client sends it. Send it in the first WebSocket frame, not in the upgrade URL, because the upgrade request path and query are logged by the proxy.

**Mangling and dropping, documented so far:**

- **Outlook Safe Links** rewrites every URL in mail and Teams messages to a Microsoft-hosted address and checks it again at click time [9]. One vendor write-up says rewriting 'breaks links that rely on exact paths or short-lived tokens' [10]. A Microsoft Q&A answer says S/MIME-signed or encrypted messages are not rewritten [11]. Whether the fragment survives a rewrite is not verified.
- **Link previews and unfurlers** fetch URLs without a human click. SnapPwd lists Slack's link_shared unfurling, Safe Links, Google Safe Browsing and Apple's Link Presentation framework as examples [8]. SnapPwd states it publishes no measured platform data, so treat its list as documentation pointers, not measurements.
- **Slack, Teams, Gmail, WhatsApp, iMessage, Jira and Confluence comments, Notion, Google Calendar invitations and QR codes:** I found no verified documentation of fragment handling for any of them. Each needs a test with a synthetic code, as in SnapPwd's protocol, before launch [8].

**Referer and Referrer-Policy.** The default is `strict-origin-when-cross-origin`. Cross-origin requests get only the origin, and HTTPS-to-HTTP requests get no Referer at all [12]. A fragment is never part of a Referer. The room path is sent only to same-origin requests. Setting `Referrer-Policy: no-referrer` on the room routes costs nothing, and the W3C TAG suggests `origin` or `no-referrer` for pages reached through capability URLs [7].

**Analytics.** Umami and any other analytics script must record the path without the hash. I did not verify how the self-hosted Umami build handles the hash, so test it. Simplest rule: no third-party scripts on `/room/*`, as the W3C TAG advises [7].

## 3. Guidance

- **W3C TAG:** capability URLs should be HTTPS, expire, and be random with at least 120 bits of entropy, which a version 4 UUID provides. Access to the URL space should be rate limited to stop enumeration. Expired URLs should return 410 Gone rather than 404, because 410 'prevents the reassignment of that capability URL to a new resource'. Human-readable capability URLs are allowed, but should not pass through a shortener with weaker enumeration protection. Owners should be able to revoke a URL, ideally by issuing several URLs per resource [7].
- **Word-based entropy (derived from [13]):** each EFF word is one of 7,776 equally likely words, so about 12.92 bits per word. Two words give 25.9 bits, three give 38.8 bits and four give 51.7 bits. A 4-digit numeric PIN gives 13.3 bits and a 6-digit one 19.9 bits.
- **Guess-rate arithmetic (derived):** a uniform guess at a 3-word code takes about 2.35 x 10^11 tries on average. At 10 tries per second that is roughly 745 years for one room. A 2-word code takes about 3.0 x 10^7 tries, roughly 35 days at 10 per second. Attackers rotate addresses, so the limit belongs on the room: lock or slow join attempts for each room after a set number of failures. OWASP's guidance on this was not read.
- **Storing a shared code:** every member must be able to get the code, but the server only needs to verify it. Store a keyed hash (HMAC with a key kept outside the database), not the plaintext, so a database dump does not open rooms. A plain fast hash is not enough, because a 38-bit secret can be brute-forced offline in hours. This is my analysis; no source was read for it.

## 4. Recycling human-friendly names

- **Jitsi, Whereby, Kahoot, URL shorteners:** expiry and reuse policies were not read; see `unverified`.
- **npm:** a published name and version can never be published again, even after unpublish [14]. Unpublishing a package entirely blocks new publishes under that name for 24 hours [14]. Packages published more than 72 hours ago can be unpublished only if no other package depends on them, they had fewer than 300 downloads in the last week, and they have a single owner [14]. The principle of immutable name-plus-version is a precedent for tombstones.
- **GitHub:** a username can be changed only to one 'not currently in use', and GitHub Support 'cannot release the unavailable username' for you [15]. When an old name is released, and whether it redirects, was not verified.
- **The risk:** an old bookmark or invite link to `/room/<slug>` could reach a different group's room that now uses the name. Because the code is in the fragment, a stranger without the old code cannot join. The stranger still sees that a room exists, and an old link carrying the old code gets refused by the new room. Real harm needs a second step, such as a squatter reserving names that people rely on.
- **Mitigations:**
  - **Tombstones:** keep closed rooms in the same table with a status, and answer 410 for the tombstone period. The period is a product decision; no source fixes it. W3C's 410 guidance supports this [7].
  - **Interstitial:** when a name points to a new room, show 'this room was closed; this name now belongs to another room' and require an explicit choice before joining.
  - **Proof of prior membership:** store a random member token in localStorage. A device that held the old room can prove it, while a stranger cannot. The weakness is that clearing storage loses the proof. This is my design; not sourced.

## 5. Generating unique names at scale

- **Space (derived):** a 2-word slug has 7,776^2 = 60,466,176 values. A 3-word slug has 7,776^3 = 470,184,984,576 values.
- **Insert-time collision (derived):** when you check a new name against names already stored, the chance of a clash is occupied/N. For 2 words, 10,000 occupied names give 0.017 percent; 1,000,000 give 1.65 percent. For 3 words, 1,000,000 give about 0.0002 percent.
- **Birthday effect (derived):** if you generate a whole batch without checking, a 1 percent chance of any clash arrives at about 1,100 two-word names. Do not assume a generated list is unique.
- **Tombstones fill the space (derived):** with permanent tombstones, 1 percent of the 2-word space is used after about 605,000 names have ever been created, and 10 percent after about 6.0 million. Permanent tombstones therefore need 3 words, or a tombstone expiry.
- **Retry on unique violation:** Postgres documents `ON CONFLICT` as 'an alternative action to raising a unique violation or exclusion constraint violation error' [16]. One statement with a `RETURNING` clause returns no row when the name is taken, so the application can try the next candidate:

```sql
INSERT INTO rooms (slug, code_hash, status, created_at)
VALUES ($1, $2, 'open', now())
ON CONFLICT (slug) DO NOTHING
RETURNING slug;
```

  Tombstones must sit in the same table, so the unique index covers them.
- **Batch anti-join (my SQL, unverified against docs):** test a batch of candidates in one query, then insert the first free one. The unique constraint is still needed for races:

```sql
SELECT c.slug
FROM unnest($1::text[]) AS c(slug)
LEFT JOIN rooms r ON r.slug = c.slug
WHERE r.slug IS NULL
LIMIT 1;
```

- **Pre-allocated pool with `FOR UPDATE SKIP LOCKED`:** the Postgres grammar is `FOR lock_strength [ OF from_reference [, ...] ] [ NOWAIT | SKIP LOCKED ]` [17]. A claim that skips rows locked by other claimers looks like this (my SQL, unverified against a running database):

```sql
UPDATE name_pool SET state = 'claimed', claimed_at = now()
WHERE slug = (
  SELECT slug FROM name_pool
  WHERE state = 'free'
  ORDER BY slug
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING slug;
```

  A pool removes insert-time retries but needs a refill job and holds names back before use. Insert-with-retry is simpler on one server.

## Recommendation

1. Use `/room/<slug>#<code>`, with a 3-word code (38.8 bits). Send the code in the first WebSocket frame and never in a URL. Require a click before joining.
2. Add per-room attempt limits, and store the code as a keyed hash.
3. Set `Referrer-Policy: no-referrer` on room routes. Keep third-party scripts off `/room/*`.
4. For names, use 2-word slugs with insert-and-retry and a finite tombstone period (410 during it), and watch occupancy. If tombstones are kept permanently, use 3-word slugs.

## Tradeoffs

- A fragment-held code cannot be seen by server-rendered link previews, so previews show only the room name.
- Word codes are easier to read aloud than digits but longer to type.
- Finite tombstones free names but bring back the bookmark risk. Permanent tombstones are safer but fill the name space, so they force 3-word names.
- Per-room attempt limits can be abused to lock out a real team. Use short lockouts.

## Decide now, because these cannot be retrofitted

1. The URL shape: the code only in the fragment, never in path or query. Existing links would break otherwise.
2. The code format and entropy, plus how the server verifies it. Changing format invalidates shared links.
3. The name rule: whether names are ever recycled, the tombstone period, and 404 or 410 for closed rooms. This sets the unique index.
4. The join protocol: code in the first WebSocket frame, no auto-join on page load.
5. Whether a room can rotate or revoke its code. Rotation changes the link a team has already shared.
6. Referrer-Policy and the third-party script policy for room routes.

Open points are listed under `unverified`.

## Not verified

- Google Meet, Whereby, Jitsi current room-password flow, Kahoot PINs, PrivateBin, tldraw and Figma: how the code is shown and how invite links are copied: Not read within the research budget; only Zoom, Jitsi issue #5902 and Excalidraw (secondary) were read.
- Excalidraw primary source for #room=id,key and key handling: Only secondary summaries were read; the repository source was not fetched.
- Fragment handling in Slack, Microsoft Teams, Gmail, WhatsApp, iMessage, Jira and Confluence comments, Notion, Google Calendar invitations and QR codes: No documentation or test result was read for any of these; needs a synthetic-link test.
- Whether Outlook Safe Links keeps the URL fragment through rewriting and click-time checks: Sources describe rewriting and breakage of paths and tokens but do not say what happens to the fragment.
- Link-preview bots fetching URLs (Slack, Teams, iMessage, WhatsApp) and whether they run JavaScript: Only a vendor blog listing fetchers was read; no platform documentation was fetched.
- Referer leakage from analytics scripts and self-hosted Umami handling of the URL hash; server and CDN log practices: Not researched beyond the W3C TAG general statement; needs a configuration test.
- OWASP guidance on secrets in URLs, rate limiting of short human codes, and secret storage: Not read; the rate-limit and keyed-hash recommendations rest on my own arithmetic and the W3C TAG.
- Dormant-name release and expiry at Jitsi, Whereby, Kahoot, and URL shorteners: Not researched.
- GitHub old-username release timing and redirects after a rename: Only the opening of the page was seen; the release and redirect section was not read.
- Postgres SKIP LOCKED pool pattern and insert-retry behaviour under concurrency: Only the grammar line was read; the SQL examples are my own and were not run against a database.
- Current versions and release dates of Elysia 2, Bun WebSocket, Zod 4, Drizzle, React 19, Umami, ClickStack: Outside the five questions asked and not looked up.
- Tombstone period, proof-of-membership and interstitial designs: Design proposals from me; no precedent source was read for these exact mechanisms.
- Outlook Safe Links rewrites URLs in mail to a Microsoft-hosted address and checks them at click time: cited, but the page was never retrieved this run
- ON CONFLICT is an alternative action to raising a unique or exclusion constraint violation; ON CONFLICT DO NOTHING avoids inserting the row: cited, but the page was never retrieved this run
- The SELECT locking clause supports FOR lock_strength with NOWAIT or SKIP LOCKED: cited, but the page was never retrieved this run

## Sources

- https://w3ctag.github.io/capability-urls/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
- https://docs.npmjs.com/policies/unpublish
- https://www.snappwd.io/blog/do-link-scanners-burn-one-time-secret-links
- https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065979
- https://devforum.zoom.us/t/getting-link-via-id-and-pass/63204/2
- https://services.dartmouth.edu/TDClient/1806/Portal/KB/Article/101739/Zoom-Passcodes-for-Meetings-and-Webinars
- https://github.com/jitsi/jitsi-meet/issues/5902
- https://dev.to/_aniruddha_d/how-to-share-encrypted-data-with-a-link-without-the-server-seeing-the-key-48gn
- https://github.com/TheCrabe/CleverProjects-excalidraw/blob/main/docs/notions/storage-backend.md
- https://codewiki.google/github.com/excalidraw/excalidraw
- https://primcast.com/workloads/excalidraw-self-hosted
- https://completefrontend.com/system-design/problems/excalidraw
- https://kb.uwstout.edu/88008
- https://mailtester.com/blog/account-confirmation-link-flagged-by-outlook-safe-links/
- https://learn.microsoft.com/en-us/questions/4375510/safelinks-dynamic-urls-and-preventing-rewriting
- https://mailtester.com/blog/safe-links-rewriting-urls-tracking/
- https://elido.app/en/blog/outlook-safe-links-url-rewriting
- https://docs.github.com/en/account-and-profile/concepts/changing-your-github-username
- https://docs.github.com/en/account-and-profile/concepts/username-changes
- https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases
- https://github.com/ncouture/eff-dice
- https://generate-random.org/passphrases
- https://safeguard.sh/resources/blog/npm-garbage-collection-abuse-attack-research
- https://braindetox.kr/en/posts/deleted_package_name_reuse.html
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy
- https://context7.com/websites/postgresql
