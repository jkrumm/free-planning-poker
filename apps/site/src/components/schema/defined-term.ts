/** schema.org DefinedTerm and DefinedTermSet as typed objects. https://schema.org/DefinedTerm, https://schema.org/DefinedTermSet */

export type TermInput = {
  name: string
  description: string
  /** Absolute address of the term's page. */
  url: string
}

export type DefinedTermData = {
  '@context': 'https://schema.org'
  '@type': 'DefinedTerm'
  name: string
  description: string
  url: string
  /** The address of the set the term belongs to: the glossary index. */
  inDefinedTermSet: string
}

export type DefinedTermSetData = {
  '@context': 'https://schema.org'
  '@type': 'DefinedTermSet'
  name: string
  description: string
  url: string
  hasDefinedTerm: Omit<DefinedTermData, '@context' | 'inDefinedTermSet'>[]
}

export function definedTerm(input: TermInput & { setUrl: string }): DefinedTermData {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: input.name,
    description: input.description,
    url: input.url,
    inDefinedTermSet: input.setUrl,
  }
}

export function definedTermSet(input: TermInput & { terms: TermInput[] }): DefinedTermSetData {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: input.name,
    description: input.description,
    url: input.url,
    hasDefinedTerm: input.terms.map((term) => ({
      '@type': 'DefinedTerm',
      name: term.name,
      description: term.description,
      url: term.url,
    })),
  }
}
