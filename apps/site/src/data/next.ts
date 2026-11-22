// What is next, for a visitor, in the order docs/v9/PLAN.md "After launch" gives it. Left out on purpose: the smoke
// round against production (an operator's monitor, not a feature), the Search Console and Bing figures (the site's
// own search data, not a room feature) and the Elysia and Drizzle upgrades (dependencies a visitor never sees).

export interface NextItem {
  title: string
  summary: string
}

export const next = [
  {
    title: 'Webhooks with results',
    summary:
      'Send each round result to a webhook, to Slack or Teams, with recipes for Zapier, Make and n8n.',
  },
  {
    title: 'Adding stories from other tools',
    summary: 'A route that fills a room queue, with a token that any player can create.',
  },
  {
    title: 'A Jira app',
    summary: 'The room inside a Jira ticket, with story points written back to the ticket.',
  },
  {
    title: 'Microsoft Teams, Zoom and Google Meet',
    summary: 'A Teams tab, and Zoom and Google Meet when they are asked for.',
  },
  {
    title: 'More ways to vote',
    summary:
      'A confidence vote, then dot voting, then a spinner wheel, each with its own page on the site.',
  },
  {
    title: 'Azure DevOps',
    summary: 'An extension for Azure DevOps.',
  },
  {
    title: 'Asynchronous rounds',
    summary: 'Rounds that people can answer in their own time, not only all at once.',
  },
  {
    title: 'More languages',
    summary: 'Further languages, chosen by what visitors speak, and guides translated into them.',
  },
  {
    title: 'A silent observer seat',
    summary: 'A seat for someone who follows a round without voting.',
  },
  {
    title: 'An AI seat',
    summary: 'A seat for an AI participant in a round.',
  },
  {
    title: 'Tracker connections',
    summary:
      'Connections to Linear, GitHub, GitLab and other trackers, held in the browser and used only on demand.',
  },
] satisfies NextItem[]
