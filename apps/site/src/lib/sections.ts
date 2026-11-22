export const sections = ['guides', 'glossary', 'vs', 'blog', 'docs'] as const
export type Section = (typeof sections)[number]
