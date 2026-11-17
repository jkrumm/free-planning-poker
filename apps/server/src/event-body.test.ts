import { describe, expect, test } from 'bun:test';

import { ATTR, eventBody } from '@fpp/shared/telemetry';

describe('eventBody', () => {
  test('is the event name alone without attributes', () => {
    expect(eventBody('room.created')).toBe('room.created');
  });

  test('appends key=value pairs and skips free-text user.name', () => {
    expect(
      eventBody('vote.cast', {
        [ATTR.ROOM_ID]: 'r1',
        [ATTR.USER_NAME]: 'Alice',
        [ATTR.VOTE_VALUE]: 5,
      }),
    ).toBe('vote.cast room.id=r1 vote.value=5');
  });
});
