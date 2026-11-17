import { ATTR, type TelemetryAttributes } from './attributes';

// Free-text attribute — never copied into a log line.
const EXCLUDED_FROM_BODY: ReadonlySet<string> = new Set([ATTR.USER_NAME]);

/**
 * Human-readable OTLP log Body for a log-based event: the event name plus its
 * `key=value` attributes (e.g. `room.created room.id=abc user.id=xyz`). Without
 * it ClickStack log search and patterns show blank lines, because the name
 * would otherwise live only in the `event.name` attribute.
 */
export function eventBody(
  name: string,
  attributes: TelemetryAttributes = {},
): string {
  const fields = Object.entries(attributes)
    .filter(
      ([key, value]) => value !== undefined && !EXCLUDED_FROM_BODY.has(key),
    )
    .map(([key, value]) => `${key}=${String(value)}`);
  return [name, ...fields].join(' ');
}
