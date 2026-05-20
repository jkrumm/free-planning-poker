import {
  context,
  propagation,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { type ElysiaWS } from 'elysia/ws';
import { ATTR } from '@fpp/shared/telemetry';
import { metrics } from '../telemetry';
import { recordError } from './app-error';

// Structural action shape (not the Action union): every action carries these,
// and SetPresenceAction lacks _traceparent, so a structural optional keeps the
// union's odd-one-out assignable without a cast.
interface InstrumentableAction {
  action: string;
  roomId: number;
  userId: string;
  _traceparent?: string;
}

// WS-message tracer. @elysiajs/opentelemetry only traces HTTP routes; WS
// message handlers run outside any active span, so without this their logs +
// events land with an empty TraceId. One span per action fixes correlation.
const wsTracer = trace.getTracer('fpp-server.ws');

/**
 * Transport/RED layer for a single WS action (spec §9). It owns ONLY:
 *  - trace continuation across the WS boundary (extract the inlined traceparent)
 *  - the `ws.<action>` span + its transport attributes
 *  - the action RED metrics (count by outcome, duration)
 *
 * The DOMAIN event + domain metric fire at the state-mutation chokepoint inside
 * room.entity / room.state — NOT here — so timer/cron-driven mutations
 * (auto-flip, the 30-min sweep, empty-room close) are measured too.
 *
 * `heartbeat` bypasses this wrapper entirely (liveness only, no span/metric).
 */
export function instrumentAction(
  ws: ElysiaWS,
  action: InstrumentableAction,
  fn: () => void,
): void {
  const parentCtx = action._traceparent
    ? propagation.extract(context.active(), {
        traceparent: action._traceparent,
      })
    : context.active();

  context.with(parentCtx, () => {
    wsTracer.startActiveSpan(`ws.${action.action}`, (span) => {
      span.setAttributes({
        [ATTR.ACTION_TYPE]: action.action,
        [ATTR.ROOM_ID]: action.roomId,
        [ATTR.USER_ID]: action.userId,
        [ATTR.FPP_WS_CONNECTION_ID]: ws.id,
      });
      const start = performance.now();
      try {
        // Handler body; the domain event/metric fire inside the entity/state.
        fn();
        metrics.actionCount.add(1, {
          [ATTR.ACTION_TYPE]: action.action,
          [ATTR.OUTCOME]: 'ok',
        });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        recordError(
          err as Error,
          { component: 'messageHandler', action: action.action },
          'high',
        );
        metrics.actionCount.add(1, {
          [ATTR.ACTION_TYPE]: action.action,
          [ATTR.OUTCOME]: 'error',
          [ATTR.ERROR_TYPE]: (err as Error).name, // bounded enum, never the message
        });
        // Best-effort reply, then swallow: one bad action must not tear down
        // the socket.
        if (err instanceof Error) {
          ws.send(
            JSON.stringify({
              error: err.message,
              timestamp: Date.now(),
              wsId: ws.id,
            }),
          );
        }
      } finally {
        metrics.actionDuration.record((performance.now() - start) / 1000, {
          [ATTR.ACTION_TYPE]: action.action,
        });
        span.end();
      }
    });
  });
}
