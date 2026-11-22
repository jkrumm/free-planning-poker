import { describe, expect, test } from 'bun:test'
import { batches, changedUrls, indexNowBody, indexNowKey, sitemapEntries } from './indexnow.ts'

const origin = 'https://free-planning-poker.com'

describe('sitemapEntries', () => {
  test('reads each address with its lastmod when it has one', () => {
    const xml = `<urlset><url><loc>${origin}/guide</loc></url><url><loc>${origin}/guides/a</loc><lastmod>2026-11-01</lastmod></url></urlset>`
    expect([...sitemapEntries(xml)]).toEqual([
      [`${origin}/guide`, undefined],
      [`${origin}/guides/a`, '2026-11-01'],
    ])
  })
})

describe('changedUrls', () => {
  test('keeps the new addresses and those whose lastmod moved, and drops the rest', () => {
    const previous = new Map([
      ['a', '1'],
      ['b', '1'],
    ])
    const current = new Map([
      ['a', '1'],
      ['b', '2'],
      ['c', undefined],
    ])
    expect(changedUrls(previous, current)).toEqual(['b', 'c'])
  })
})

describe('batches', () => {
  test('splits a list into batches of at most the size', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('indexNowBody', () => {
  test('names the host and the key, and no key location: the key file sits at the root', () => {
    const body = JSON.parse(indexNowBody([`${origin}/guide`]))
    expect(body).toEqual({
      host: 'free-planning-poker.com',
      key: indexNowKey,
      urlList: [`${origin}/guide`],
    })
  })
})
