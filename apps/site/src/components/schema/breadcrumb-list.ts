/** schema.org BreadcrumbList as a typed object. https://schema.org/BreadcrumbList, https://developers.google.com/search/docs/appearance/structured-data/breadcrumb */

export type BreadcrumbInput = { name: string; url: string }

export type BreadcrumbListData = {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: { '@type': 'ListItem'; position: number; name: string; item: string }[]
}

export function breadcrumbList(items: BreadcrumbInput[]): BreadcrumbListData {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
