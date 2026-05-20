/**
 * Typed telemetry taxonomy — the single, vendor-agnostic source of truth for
 * attribute keys (ATTR), event names (EVENT) and metric descriptors (METRIC),
 * shared by the web client and the authoritative fpp-server.
 *
 * Imported as `@fpp/shared/telemetry` (its own subpath so it stays free of the
 * TypeBox/elysia runtime that `@fpp/shared` carries via `room.actions`).
 *
 * See docs/otel-migration/05-observability-v2.md.
 */
export * from './attributes';
export * from './events';
export * from './metrics';
