# Tracker access from a browser, without a stored credential

Research run of 2026-11-21 (`agw research`, depth standard). Run status: ok. Citations grounded against fetched pages: 18/18. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Fully in the browser, no stored secret (documented):** GitLab. Its docs describe PKCE for single-page apps without a client secret, and state that the /oauth/token endpoint supports CORS preflight. Trello also issues a user token straight into the browser. Both are provisional for API calls, because I did not verify CORS on the resource APIs.
- **Browser possible, but provisional:** Linear (PKCE with no secret, 24-hour access tokens, rotating refresh tokens) and GitHub (device flow needs no secret). Linear's and GitHub's API and token-endpoint CORS were not verified.
- **Needs a server-held secret under the documented flow:** Jira Cloud (3LO token exchange shows client_secret), Asana (token exchange uses the client secret), ClickUp (OAuth token exchange needs the client secret), and GitHub's web flow. Atlassian also says apps that collect API tokens do not meet its cloud security requirements.
- **Estimate write-back:** only Shortcut's estimate field was seen in its docs (writable, clearable with null). The others were not checked in this run.
- **Jira Forge (in-app):** the app calls the Jira REST API on behalf of the user in the browser, with no credential on the app owner's side. This is a different architecture: it runs inside Jira, not as a standalone page on our origin.
- **Open:** Jira Data Center, Azure DevOps, YouTrack, and secret-less Jira/Asana OAuth were not settled in this run.

## Method and limits

I read the vendor docs for Atlassian 3LO, GitHub OAuth, Linear OAuth, GitLab OAuth, Azure DevOps OAuth (deprecated page), Asana OAuth, ClickUp authentication, Trello authorization, and Shortcut API v3. I used search snippets for Entra ID PKCE, Forge requestJira, and YouTrack permanent tokens. I did not inspect any API response headers. Every CORS verdict below rests only on what a vendor page says, and where it says nothing, the verdict is marked unverified.

## Verdict table

Legend: A = works fully in the browser; B = needs a stateless pass-through proxy; C = needs a server-held secret; ? = not established.

| Tracker | (1) CORS on API | (2) Public-client auth, no secret | (3) Token lifetime / refresh | (4) Estimate write-back | Verdict |
|---|---|---|---|---|---|
| Jira Cloud | Not stated in the 3LO page | 3LO token exchange example includes client_secret; PKCE not seen in the read part | expires_in returned; value not read | Not checked | C per documented flow |
| Jira Data Center | Not checked | Not checked | Not checked | Not checked | ? |
| Linear | Not stated for GraphQL or token endpoint | PKCE; client_secret optional when PKCE is used | Access token 24 h; refresh token 30 days, new pair on each refresh | Not checked | A provisional (B if CORS is absent) |
| GitHub Issues/Projects | api.github.com not checked; the authorize endpoint states preflight is not supported | Web flow accepts PKCE S256 but its token exchange lists client_secret; device flow needs client_id only | Access 8 h, refresh 6 months unused, only with expiring tokens; device-flow refresh needs no secret | Not checked (Issues have no native estimate) | A provisional via device flow |
| GitLab | Token endpoint CORS documented; resource API CORS not stated | PKCE for SPAs, no secret | Access 7200 s; each refresh invalidates the old pair; refresh with client_id only in the PKCE example | Not checked | A for auth; API CORS unverified |
| Azure DevOps | Not checked | OAuth deprecated, no new registrations since April 2025; Entra ID is recommended, and Entra's auth-code flow supports PKCE (snippet) | Not checked | Not checked | ? |
| Trello | Not stated | Token issued in browser via 1/authorize with response_type=token; client.js is the browser wrapper | expiration option: 1hour, 1day, 30days or never; revoked tokens return 401 | Not checked | A for token issuance; API CORS unverified |
| Asana | Not checked | PKCE parameters on authorize; token exchange documented with client secret | Access token lasts 1 hour; refresh while the user stays authorized | Not checked | C per documented flow |
| ClickUp | Not checked | OAuth token exchange requires client_secret; personal token (pk_) is pasted by the user | OAuth token currently does not expire ('subject to change'); personal tokens never expire | Not checked | C for OAuth; pasted personal token A provisional |
| Shortcut | Not stated in the docs read | Token in Shortcut-Token header; no OAuth flow read | No expiry stated; tokens grant full account access | Story estimate is writable and clearable with null | Pasted token: A provisional |
| YouTrack | Not checked | Permanent token recommended for REST (snippet) | Not checked | Not checked | ? |
| Forge / Connect (in-app) | n/a | Forge: requestJira calls the REST API as the user in the browser (snippet) | n/a | n/a | No credential on our side; not a standalone SPA |

## (1) CORS

None of the vendor pages read states a general CORS policy for the resource API. GitLab states CORS for /oauth endpoints only. GitHub states the authorize endpoint does not support preflight. Whether api.github.com, api.linear.app, Asana, ClickUp, Trello, Shortcut or YouTrack send Access-Control-Allow-Origin for arbitrary origins was not verified. Test it with a single preflight request before relying on it.

## (2) Public-client auth

- GitLab: PKCE without a secret, which the docs call 'advantageous for single page JavaScript applications'.
- Linear: PKCE, client_secret optional. Refresh with PKCE needs only client_id.
- GitHub: device flow needs no client_secret. The web flow's token exchange lists client_secret as required.
- Atlassian 3LO, Asana and ClickUp: the documented token exchange includes the client secret, so a public client needs a server to hold it.
- Trello: the browser token flow needs no secret. OAuth 1.0 needs an application secret.
- Shortcut and YouTrack: pasted API token or permanent token; no OAuth read.
- Azure DevOps: legacy OAuth is deprecated. Entra ID is recommended, which supports PKCE.

## (3) Token lifetime and refresh

- Linear: access token 24 h; refresh token 30 days; each refresh issues a new refresh token. A lost refresh response can be retried within 30 minutes.
- GitLab: access 7200 s; refresh invalidates the old access and refresh token.
- GitHub: 8 h access and 6 months refresh only when expiring tokens are enabled or offline_access is requested. Otherwise tokens do not expire.
- Asana: 1 h access token; refresh repeats as long as the user has authorized the app.
- Trello: the developer picks 1hour, 1day, 30days or never at authorization time.
- ClickUp OAuth: no expiry currently, subject to change. Personal tokens never expire.
- Shortcut: no expiry stated. Tokens that become public are invalidated.

## (4) Estimate write-back

Shortcut's docs say you 'can estimate a story as 1', and remove the estimate by sending null. This is the only write-back confirmed in this run. Linear, GitLab weight, GitHub Projects number fields, Jira story-point custom fields, Asana and ClickUp custom fields, Trello and YouTrack were not checked.

## (5) Forge and Connect

The Forge requestJira page (snippet, not fully read) says the bridge calls the Jira Cloud REST API 'on behalf of the user who is currently interacting with the app in the browser'. The app holds no tracker token on the owner's side. This meets the no-stored-credential goal, but the room app would then need to be a Forge app installed in the customer's Jira. Connect uses Atlassian-signed JWTs and was not read.

## (6) Known products using a browser-held token

Not researched in this run. Treat any claim about specific products as unverified.

## (7) Token storage trade-offs (reasoning, not sourced)

No source was read for this section; it is my analysis.

- localStorage: survives reloads, but any script on the origin can read it, so a single XSS exposes the token.
- Memory only: nothing persists across reloads, which limits exposure but forces the user to reconnect. Refresh tokens are the real risk, so keep them out of storage if you can.
- Non-extractable WebCrypto key: the key bytes cannot be exported, but a page that is running can still use the key to unwrap a token stored in IndexedDB. It does not stop live XSS. It only protects copies at rest.

For PKCE public clients (GitLab, Linear), rotating refresh tokens limit replay: a stolen refresh token that has already been used stops working.

## Recommendation

Build the browser-only path first for GitLab and Trello, then test CORS on each API with one preflight request. Add Linear and GitHub device flow after that. Leave Jira Cloud, Asana and ClickUp OAuth behind a stateless pass-through if the secret cannot be avoided, and check Atlassian's policy before collecting Jira API tokens at all.

## Not verified

- CORS on resource APIs for every tracker (1): No API response headers were checked; only the GitLab /oauth endpoints and GitHub's authorize endpoint have CORS statements read in the docs.
- Jira Cloud secret-less PKCE on 3LO and token lifetime value: The page read shows client_secret in the token example; PKCE and the expires_in value were not in the read part, and the page was truncated.
- Jira Data Center (all questions): Not researched within budget.
- Asana PKCE token exchange without secret and CORS: Page was truncated before the token exchange section; no CORS statement read.
- Azure DevOps Entra ID PKCE/SPA setup, CORS and story-point field: Only the deprecation notice was read; the Entra guide was not fetched.
- YouTrack CORS, OAuth, token lifetime and estimate field: Only a search snippet was seen; the page was not fetched.
- Estimate or story-point write-back for Linear, GitLab, GitHub Projects, Jira, Asana, ClickUp, Trello: Field names and write endpoints not read in this run; only Shortcut's estimate field was seen.
- Known products that hold a tracker token in the browser (6): No search was made for such products within budget.
- Token storage trade-offs (7): Reasoning only; no source was read for this section.
- Forge requestJira full text and Connect JWT model: Only the search snippet was seen; the page was not fetched and Connect was not read.

## Sources

- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://linear.app/developers/oauth-2-0-authentication
- https://docs.gitlab.com/api/oauth2/
- https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth
- https://developers.asana.com/docs/oauth
- https://developer.clickup.com/docs/authentication
- https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- https://developer.shortcut.com/api/rest/v3
- https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/requestJira/
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- https://www.jetbrains.com/help/youtrack/devportal/authentication-with-permanent-token.html
- https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops
