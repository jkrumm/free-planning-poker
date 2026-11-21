/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';

import {
  UMAMI_PRODUCTION_HOSTNAME,
  buildUmamiScriptProps,
  umamiBeforeSend,
} from './umami';

describe('buildUmamiScriptProps', () => {
  test('is null unless both public values are set', () => {
    expect(
      buildUmamiScriptProps({ scriptUrl: undefined, websiteId: undefined }),
    ).toBeNull();
    expect(
      buildUmamiScriptProps({
        scriptUrl: 'https://u.test/p.js',
        websiteId: undefined,
      }),
    ).toBeNull();
    expect(
      buildUmamiScriptProps({ scriptUrl: undefined, websiteId: 'abc' }),
    ).toBeNull();
  });

  test('carries the page-view-only attributes when both are set', () => {
    expect(
      buildUmamiScriptProps({
        scriptUrl: 'https://u.test/p.js',
        websiteId: 'abc',
      }),
    ).toEqual({
      src: 'https://u.test/p.js',
      'data-website-id': 'abc',
      'data-domains': UMAMI_PRODUCTION_HOSTNAME,
      'data-exclude-search': 'true',
      'data-before-send': 'fppUmamiBeforeSend',
    });
  });
});

describe('umamiBeforeSend', () => {
  test('rewrites a room path and hides the room name in the title', () => {
    expect(
      umamiBeforeSend('event', {
        url: '/room/abc',
        title: 'abc',
        referrer: '',
        hostname: 'free-planning-poker.com',
      }),
    ).toEqual({
      url: '/room/:slug',
      title: 'Room',
      referrer: '',
      hostname: 'free-planning-poker.com',
    });
  });

  test('rewrites the absolute url Umami sends, and the room title', () => {
    expect(
      umamiBeforeSend('event', {
        url: 'https://free-planning-poker.com/room/abc',
        title: 'Free Planning Poker - abc',
        referrer: '',
      }),
    ).toEqual({
      url: 'https://free-planning-poker.com/room/:slug',
      title: 'Room',
      referrer: '',
    });
  });

  test('rewrites a room referrer, relative or absolute', () => {
    expect(
      umamiBeforeSend('event', { url: '/', referrer: '/room/abc' })?.referrer,
    ).toBe('/room/:slug');
    expect(
      umamiBeforeSend('event', {
        url: '/',
        referrer: 'https://free-planning-poker.com/room/abc',
      })?.referrer,
    ).toBe('https://free-planning-poker.com/room/:slug');
  });

  test('leaves other pages and external referrers alone', () => {
    const payload = {
      url: '/guide',
      title: 'Guide',
      referrer: 'https://example.com/x',
    };
    expect(umamiBeforeSend('event', payload)).toEqual(payload);
  });

  test('drops everything but page views', () => {
    for (const type of ['identify', 'performance', 'error']) {
      expect(umamiBeforeSend(type, { url: '/' })).toBeNull();
    }
  });
});
