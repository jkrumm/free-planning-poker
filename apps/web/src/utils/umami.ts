/**
 * Umami's cookieless tracker, loaded on page views only.
 *
 * The tracker reads `window[data-before-send]` before every send and calls it
 * as `(type, payload)`; a falsy return cancels the send. A page view has type
 * `event`; `identify`, `performance` and `error` are dropped.
 */

/** Only the production host is measured; previews and local runs stay out. */
export const UMAMI_PRODUCTION_HOSTNAME = 'free-planning-poker.com';

/** Global the tracker looks up by name (the `data-before-send` value). */
export const UMAMI_BEFORE_SEND_GLOBAL = 'fppUmamiBeforeSend';

const ROOM_PATH = /^\/room\/[^/?#]+/;
const ROOM_URL = /^(https?:\/\/[^/]+)?\/room\/[^/?#]+/;
const ROOM_PATH_TEMPLATE = '/room/:slug';

export interface UmamiPayload {
  url?: string;
  referrer?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * Room names live in the path and in the document title of a room page, and
 * reach the next page as its referrer. None of them may reach Umami.
 */
export function umamiBeforeSend(
  type: string,
  payload: UmamiPayload,
): UmamiPayload | null {
  if (type !== 'event') return null;

  const isRoomPage = !!payload.url && ROOM_PATH.test(payload.url);
  return {
    ...payload,
    ...(payload.url && {
      url: payload.url.replace(ROOM_PATH, ROOM_PATH_TEMPLATE),
    }),
    ...(payload.referrer && {
      referrer: payload.referrer.replace(ROOM_URL, (_, origin = '') => {
        return `${origin}${ROOM_PATH_TEMPLATE}`;
      }),
    }),
    ...(isRoomPage && { title: 'Room' }),
  };
}

export interface UmamiScriptProps {
  src: string;
  'data-website-id': string;
  'data-domains': string;
  'data-exclude-search': 'true';
  'data-before-send': string;
}

/** The tag's attributes, or `null` while either public value is unset. */
export function buildUmamiScriptProps({
  scriptUrl,
  websiteId,
}: {
  scriptUrl: string | undefined;
  websiteId: string | undefined;
}): UmamiScriptProps | null {
  if (!scriptUrl || !websiteId) return null;
  return {
    src: scriptUrl,
    'data-website-id': websiteId,
    'data-domains': UMAMI_PRODUCTION_HOSTNAME,
    'data-exclude-search': 'true',
    'data-before-send': UMAMI_BEFORE_SEND_GLOBAL,
  };
}
