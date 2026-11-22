// Every string of the navigation and the footer, in one place (invariant 18). The page bodies are content.
export const strings = {
  siteName: 'Free-Planning-Poker.com',
  homeTitle: 'Free Planning Poker | Quick & Easy Estimates',
  titlePrefix: 'Free Planning Poker - ',
  navLabel: 'Main',
  footerLabel: 'Footer',
  draftLine: 'Draft: this page is not published yet.',
  questionsHeading: 'Questions',
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Guide', href: '/guide' },
    { title: 'Analytics', href: '/analytics' },
    { title: 'Contact', href: '/contact' },
  ],
  footerPages: [
    { title: 'Home', href: '/' },
    { title: 'Guide', href: '/guide' },
    { title: 'Analytics', href: '/analytics' },
    { title: 'Roadmap', href: '/roadmap' },
    { title: 'Contact', href: '/contact' },
  ],
  footerLegal: [
    { title: 'Roadmap', href: '/roadmap' },
    { title: 'Privacy', href: '/privacy' },
    { title: 'Imprint', href: '/imprint' },
    { title: 'Donate', href: 'https://paypal.me/johanneskrum' },
    { title: 'GitHub', href: 'https://github.com/jkrumm/free-planning-poker' },
  ],
  releases: { title: 'Releases', href: 'https://github.com/jkrumm/free-planning-poker/releases' },
  license: { title: 'AGPLv3', href: '/imprint#license' },
  credit: 'Created by Johannes Krumm',
  backToTop: 'Back to Top',
} as const
