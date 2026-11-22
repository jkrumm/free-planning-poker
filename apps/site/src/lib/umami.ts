import { umamiScriptTags } from '@fpp/telemetry/umami-script'

/**
 * Umami's two tags for every page's head, from the build's two public variables: `FPP_UMAMI_WEBSITE_ID` (no tag when it
 * is unset, as in a self-hosted build) and `FPP_UMAMI_DOMAINS` (the hostnames that may send: the beta host now, the
 * production one at the cutover).
 */
export const umamiTags: string = umamiScriptTags({
  websiteId: process.env.FPP_UMAMI_WEBSITE_ID,
  domains: process.env.FPP_UMAMI_DOMAINS,
})
