import { FEEDBACK_LIMITS, type FeedbackInput } from '@fpp/shared';

/**
 * Forwards in-app feedback to the software-factory door. The door is
 * tailnet-only and takes a bearer token, so this runs on the server and the
 * browser never sees either. Everything environmental (clock, fetch, limits)
 * is injected so the module is testable through `submit` alone.
 */

export interface FeedbackConfig {
  /** Full door URL including the app, e.g. https://<host>:8796/feedback/free-planning-poker */
  url: string | undefined;
  token: string | undefined;
  /** Max submissions per client within `windowMs`. */
  perClientLimit?: number;
  /** Max submissions across all clients within `windowMs`. */
  globalLimit?: number;
  windowMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export type FeedbackResult =
  | { status: 200; body: { success: true } }
  | { status: 429; body: { error: string }; retryAfterSeconds: number }
  | { status: 502 | 503; body: { error: string } };

export interface FeedbackService {
  submit(input: FeedbackInput, clientKey: string): Promise<FeedbackResult>;
}

export function createFeedbackService(config: FeedbackConfig): FeedbackService {
  const perClientLimit = config.perClientLimit ?? 3;
  const globalLimit = config.globalLimit ?? 30;
  const windowMs = config.windowMs ?? 10 * 60 * 1000;
  const timeoutMs = config.timeoutMs ?? 5000;
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? Date.now;

  // Sliding windows of accepted-attempt timestamps. A refused-by-door attempt
  // still counts: it cost a downstream call.
  const byClient = new Map<string, number[]>();
  let all: number[] = [];

  const prune = (stamps: number[], t: number) =>
    stamps.filter((s) => t - s < windowMs);

  function checkLimit(clientKey: string, t: number): number | null {
    all = prune(all, t);
    const mine = prune(byClient.get(clientKey) ?? [], t);
    if (mine.length === 0) byClient.delete(clientKey);
    else byClient.set(clientKey, mine);

    const blocked =
      mine.length >= perClientLimit
        ? mine[0]!
        : all.length >= globalLimit
          ? all[0]!
          : null;
    if (blocked === null) return null;
    return Math.max(1, Math.ceil((blocked + windowMs - t) / 1000));
  }

  function record(clientKey: string, t: number) {
    all.push(t);
    byClient.set(clientKey, [...(byClient.get(clientKey) ?? []), t]);
  }

  return {
    async submit(input, clientKey) {
      if (!config.url || !config.token) {
        return { status: 503, body: { error: 'Feedback is not available' } };
      }

      const t = now();
      const retryAfterSeconds = checkLimit(clientKey, t);
      if (retryAfterSeconds !== null) {
        return {
          status: 429,
          body: { error: 'Too many submissions, try again later' },
          retryAfterSeconds,
        };
      }
      record(clientKey, t);

      const text = input.text?.trim();
      try {
        const response = await doFetch(config.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            title: input.title.trim().slice(0, FEEDBACK_LIMITS.TITLE_MAX),
            ...(text && { text: text.slice(0, FEEDBACK_LIMITS.TEXT_MAX) }),
            version: input.version,
            route: input.route,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          return {
            status: 502,
            body: { error: `Feedback refused (${response.status})` },
          };
        }
        return { status: 200, body: { success: true } };
      } catch {
        return { status: 502, body: { error: 'Feedback could not be sent' } };
      }
    },
  };
}
