import { identity } from './identity.ts'

/**
 * schema.org SoftwareApplication as a typed object. https://schema.org/SoftwareApplication
 *
 * There is no aggregateRating or review field on purpose: the type cannot carry a rating, so none can be
 * self-assigned. Google's software app rich result wants one of the two; this page forgoes the rich result until real
 * ratings exist, and a field is added then with their source.
 */
export type SoftwareApplicationData = {
  '@context': 'https://schema.org'
  '@type': 'SoftwareApplication'
  name: string
  description: string
  url: string
  applicationCategory: 'BusinessApplication'
  operatingSystem: 'Any'
  browserRequirements: string
  isAccessibleForFree: true
  license: string
  offers: { '@type': 'Offer'; price: '0'; priceCurrency: 'EUR' }
}

export function softwareApplication(): SoftwareApplicationData {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: identity.name,
    description: identity.description,
    url: identity.origin,
    applicationCategory: 'BusinessApplication',
    // A web app: any system with a browser.
    operatingSystem: 'Any',
    browserRequirements: 'Requires a current web browser',
    isAccessibleForFree: true,
    license: identity.license,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }
}
