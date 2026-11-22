import { identity } from './identity.ts'

/** schema.org Organization and WebSite as typed objects. https://schema.org/Organization, https://schema.org/WebSite */

export type OrganizationData = {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  alternateName: string
  url: string
  description: string
  sameAs: readonly string[]
}

export type WebSiteData = {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  alternateName: string
  url: string
  description: string
  inLanguage: 'en'
}

export function organization(): OrganizationData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: identity.name,
    alternateName: identity.alternateName,
    url: identity.origin,
    description: identity.description,
    sameAs: identity.sameAs,
  }
}

export function webSite(): WebSiteData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: identity.name,
    alternateName: identity.alternateName,
    url: identity.origin,
    description: identity.description,
    inLanguage: 'en',
  }
}
