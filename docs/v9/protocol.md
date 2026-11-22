# v9 room protocol

The exact reference of the room protocol, version 1. `docs/v9/ARCHITECTURE.md`, section Protocol, is its summary; where the two differ, this file is right and the summary is corrected. The schemas are in `packages/room-core/src/protocol/schema.ts` (Zod, entry `@fpp/room-core/protocol`), the same shapes as TypeScript types without Zod in `src/protocol/types.ts` (entry `@fpp/room-core/types`), and every frame, command and event has a fixture under `packages/room-core/fixtures/v1/`. A change to any of them follows `.claude/rules/protocol.md`; `packages/room-core/test/protocol.test.ts` fails when the names here, in the schemas and in the fixtures differ.

## Transport

- JSON text frames over one WebSocket at `/api/ws/<slug>`. Every frame is a JSON object with a field `frame` that names it; `cmd`, `evt` and `fx` also carry `type` and `payload`.
- The client opens with `hello`; the server answers with `welcome` or closes with a close code. Then the client sends `cmd`, the server answers each with `ack` or `nack` and publishes `evt` to every seat.
- Every `evt` carries the room's `seq`, one higher than the last. A client that sees a gap reconnects with `lastSeq` and gets a fresh `welcome`.
- Every `cmd` carries a client message id. A repeated id of an accepted command, one that changed nothing included, is answered with `ack` again and applied once; the room remembers the latest 256.
- Every event is identical for all seats and never carries a hidden vote. A seat reads its own hidden card only from its own `welcome` view or its own command.
- `fx` frames carry no `seq`, are never stored and are dropped for slow consumers.
- Unknown fields and unknown types are ignored by both sides. Times are milliseconds since the epoch, except `at` in a result, which is ISO 8601. Ids of topics, rounds and results are UUID v7, minted by the server.
- Maximum payload 16 KB, per-message deflate off, `Origin` checked before the upgrade, application heartbeat every 25 s.

## Frames

### `hello`

Client to server, first frame. `v` (protocol version, 1), `build`, `name` (1 to 32 characters), `avatar` (seed), and optionally `seatToken` (resume a seat), `lastSeq`, `code` (a locked room's password, from the link's fragment), `device` (anonymous device id, counted only), `embed` (the host that frames the room). Example: [`frames/hello.json`](../../packages/room-core/fixtures/v1/frames/hello.json).

### `welcome`

Server to client. `v`, `build`, `seat` (this seat's index), `seatToken`, `seq` (the room's current), `view` (the full view for this seat, see The view). Example: [`frames/welcome.json`](../../packages/room-core/fixtures/v1/frames/welcome.json).

### `cmd`

Client to server. `id` (client message id, 1 to 64 characters), `type`, `payload` (see Commands), optional `traceparent` (W3C, at most 64 characters). Example: [`frames/cmd.json`](../../packages/room-core/fixtures/v1/frames/cmd.json).

### `ack`

Server to client: the command `id` was applied, or was a repeat, or changed nothing. Example: [`frames/ack.json`](../../packages/room-core/fixtures/v1/frames/ack.json).

### `nack`

Server to client: the command `id` was refused for `reason` (see Rejection reasons). Nothing changed. Example: [`frames/nack.json`](../../packages/room-core/fixtures/v1/frames/nack.json).

### `evt`

Server to every seat. `seq`, `type`, `payload` (see Events). Example: [`frames/evt.json`](../../packages/room-core/fixtures/v1/frames/evt.json).

### `fx`

Both ways, ephemeral. `type`, `payload` (see Fx), and from the server `seat`, the sender. At most one per 2 s per seat. Example: [`frames/fx.json`](../../packages/room-core/fixtures/v1/frames/fx.json).

### `ping`

Both ways, no fields; answered with `pong`. Example: [`frames/ping.json`](../../packages/room-core/fixtures/v1/frames/ping.json).

### `pong`

Both ways, no fields. Example: [`frames/pong.json`](../../packages/room-core/fixtures/v1/frames/pong.json).

## Commands

A seat sends these in a `cmd` frame. Each type starts with its owner: `poker` (the activity), `topic`, `seat`, `room` (the room kernel). Every player may run the room; a spectator may only rename itself, change its own role and presence, and leave (`forbidden` otherwise). A command that names a round is refused when that round has moved on. A command that would change nothing is acknowledged and publishes nothing.

### `poker.vote`

`{ round, card }`: play the card with this label in the current round; a vote can change until the reveal. Refused: `round_unknown`, `round_closed` (revealed or not current), `card_unknown`. Publishes `poker.voted`, and when auto reveal is on and every active player has voted, `poker.countdownStarted` (or the reveal at once with a countdown of 0). Example: [`commands/poker.vote.json`](../../packages/room-core/fixtures/v1/commands/poker.vote.json).

### `poker.clearVote`

`{ round }`: take the own card back. Publishes `poker.voteCleared`; a running countdown whose condition no longer holds is cancelled. Example: [`commands/poker.clearVote.json`](../../packages/room-core/fixtures/v1/commands/poker.clearVote.json).

### `poker.reveal`

`{ round }`: reveal now. Needs one vote (`no_votes`). A second reveal of a revealed round is acknowledged and changes nothing. Publishes `poker.revealed`, and `topic.decided` (decided by `agreed`) when every vote is the same estimate card. Example: [`commands/poker.reveal.json`](../../packages/room-core/fixtures/v1/commands/poker.reveal.json).

### `poker.cancelReveal`

`{ round }`: stop the running countdown; auto reveal stays off for this round. Publishes `poker.countdownCancelled` with `armed: false`. Example: [`commands/poker.cancelReveal.json`](../../packages/room-core/fixtures/v1/commands/poker.cancelReveal.json).

### `poker.revote`

`{ round }`: vote again on the same topic; the round must be the current one and revealed (`not_revealed`). Refused with `topic_decided` when the topic was decided on this round, by a unanimous reveal or by `poker.settle`: the decision wins, and a player corrects it with `poker.settle`. Publishes `poker.roundStarted` with the next attempt. Example: [`commands/poker.revote.json`](../../packages/room-core/fixtures/v1/commands/poker.revote.json).

### `poker.settle`

`{ round, card }`: set the topic's final value to an estimate card of the round's deck. The round must be its topic's latest and revealed (`not_revealed`, `round_closed`); the topic may already be done. A later settle corrects the value. Publishes `topic.decided` (decided by `settled`). Example: [`commands/poker.settle.json`](../../packages/room-core/fixtures/v1/commands/poker.settle.json).

### `topic.add`

`{ topics: [{ title, url, ref }] }`: 1 to 200 topics at the end of the queue, so a pasted list is one command. `title` is 1 to 300 characters or `null` (untitled), `url` an http(s) link or `null`, `ref` a tracker reference `{ source, id, key, site }` or `null`. Refused with `queue_full` beyond 200 open topics. Publishes `topic.added`. Example: [`commands/topic.add.json`](../../packages/room-core/fixtures/v1/commands/topic.add.json).

### `topic.update`

`{ topic, title, url, ref }`: replace a topic's title, link and reference, in any state. Publishes `topic.updated`. Example: [`commands/topic.update.json`](../../packages/room-core/fixtures/v1/commands/topic.update.json).

### `topic.move`

`{ topic, index }`: move a topic to a place in the list (clamped to the end). Publishes `topic.moved`. Example: [`commands/topic.move.json`](../../packages/room-core/fixtures/v1/commands/topic.move.json).

### `topic.remove`

`{ topic }`: remove a queued topic (`topic_not_queued` otherwise). Publishes `topic.removed`. Example: [`commands/topic.remove.json`](../../packages/room-core/fixtures/v1/commands/topic.remove.json).

### `topic.next`

`{ round, to? }`: move on from the current round's topic to `to` (a queued topic), or to the first queued one, or to a new untitled topic when the queue is empty. Publishes `topic.closed` (`done` if the topic had a reveal, else `skipped`), `topic.added` for an untitled one, `topic.activated` and `poker.roundStarted`. Example: [`commands/topic.next.json`](../../packages/room-core/fixtures/v1/commands/topic.next.json).

### `seat.rename`

`{ name }`: rename the own seat, 1 to 32 characters. Publishes `seat.renamed`. Example: [`commands/seat.rename.json`](../../packages/room-core/fixtures/v1/commands/seat.rename.json).

### `seat.setRole`

`{ seat, role }`: `player` or `spectator`; a spectator may change only its own role. Refused with `players_full` or `spectators_full`. A player who becomes a spectator loses a hidden vote. Publishes `seat.roleChanged`. Example: [`commands/seat.setRole.json`](../../packages/room-core/fixtures/v1/commands/seat.setRole.json).

### `seat.setPresence`

`{ presence }`: `active` or `away` (tab hidden for 30 s) for the own seat. Away seats never block auto reveal. Publishes `seat.presenceChanged`. Example: [`commands/seat.setPresence.json`](../../packages/room-core/fixtures/v1/commands/seat.setPresence.json).

### `seat.kick`

`{ seat }`: remove a seat; the server closes its socket with 4003. Publishes `seat.kicked`. Example: [`commands/seat.kick.json`](../../packages/room-core/fixtures/v1/commands/seat.kick.json).

### `seat.leave`

`{}`: leave the room. Publishes `seat.left`. Example: [`commands/seat.leave.json`](../../packages/room-core/fixtures/v1/commands/seat.leave.json).

### `room.setSettings`

`{ deck?, autoReveal?, revealCountdown?, timer? }`: change some settings. `deck` is a built-in deck exactly as defined or `{ id: "custom", cards }` with 1 to 20 ascending numbered cards; it applies to the current round only while that round has no vote. `revealCountdown` is 0 to 10 seconds, `timer` 0, 30, 60 or 120 seconds and applies from the next round. Publishes `room.settingsChanged` with all settings. Example: [`commands/room.setSettings.json`](../../packages/room-core/fixtures/v1/commands/room.setSettings.json).

### `room.setTitle`

`{ name }`: the room's display name, 1 to 60 characters. Publishes `room.titleChanged`. Example: [`commands/room.setTitle.json`](../../packages/room-core/fixtures/v1/commands/room.setTitle.json).

## Server commands

The server issues these to the reducer itself; they never arrive in a `cmd` frame. They exist so that every change of a room is an event.

### `seat.join`

`{ name, avatar, role }` at `hello`: mint a seat at the next index (indices are never reused while the room is live). Refused with `players_full` (the client is offered a spectator seat) or `spectators_full`. Publishes `seat.joined`. Example: [`server-commands/seat.join.json`](../../packages/room-core/fixtures/v1/server-commands/seat.join.json).

### `seat.setConnection`

`{ seat, presence }`: `reconnecting` when the socket is lost, `gone` 120 s later, `active` when it is back. A gone seat leaves the table and counts against no limit; coming back is refused when the table is full. Publishes `seat.presenceChanged`. Example: [`server-commands/seat.setConnection.json`](../../packages/room-core/fixtures/v1/server-commands/seat.setConnection.json).

### `room.setAccess`

`{ access, code }` after `PUT /api/rooms/:slug/access`. Publishes `room.accessChanged`. Example: [`server-commands/room.setAccess.json`](../../packages/room-core/fixtures/v1/server-commands/room.setAccess.json).

### `room.setSlug`

`{ slug }` after `PUT /api/rooms/:slug/name`: the room's primary address. Publishes `room.slugChanged`. Example: [`server-commands/room.setSlug.json`](../../packages/room-core/fixtures/v1/server-commands/room.setSlug.json).

### `poker.countdownElapsed`

`{ round }` when a countdown's time is up: reveals the round. A stale one changes nothing. Example: [`server-commands/poker.countdownElapsed.json`](../../packages/room-core/fixtures/v1/server-commands/poker.countdownElapsed.json).

### `poker.timerElapsed`

`{ round }` when the round timer runs out: with auto reveal on and armed and one vote cast, starts the countdown (cause `timer`); otherwise nothing happens. Example: [`server-commands/poker.timerElapsed.json`](../../packages/room-core/fixtures/v1/server-commands/poker.timerElapsed.json).

## Events

Published in an `evt` frame, the same for every seat.

### `poker.roundStarted`

`{ round: { id, topic, no, attempt, deck, startedAt, timerEndsAt } }`: a new round on the active topic; `no` counts the room's rounds, `attempt` the topic's. Example: [`events/poker.roundStarted.json`](../../packages/room-core/fixtures/v1/events/poker.roundStarted.json).

### `poker.voted`

`{ round, seat }`: that seat has a card in the round. Never the card. Example: [`events/poker.voted.json`](../../packages/room-core/fixtures/v1/events/poker.voted.json).

### `poker.voteCleared`

`{ round, seat }`. Example: [`events/poker.voteCleared.json`](../../packages/room-core/fixtures/v1/events/poker.voteCleared.json).

### `poker.countdownStarted`

`{ round, endsAt, cause }`: auto reveal fires at `endsAt`; `cause` is `votes` (every active player voted) or `timer`. Example: [`events/poker.countdownStarted.json`](../../packages/room-core/fixtures/v1/events/poker.countdownStarted.json).

### `poker.countdownCancelled`

`{ round, armed }`: `armed: false` when a player cancelled it, so auto reveal stays off for the round; `true` when its condition stopped holding. Example: [`events/poker.countdownCancelled.json`](../../packages/room-core/fixtures/v1/events/poker.countdownCancelled.json).

### `poker.revealed`

`{ round, at, by, votes: [{ seat, card }], result }`: every card of the round, `by` the seat that revealed or `null` for an automatic reveal, `result` the result contract. Example: [`events/poker.revealed.json`](../../packages/room-core/fixtures/v1/events/poker.revealed.json).

### `topic.added`

`{ topics }`: topics appended to the list, each `{ id, title, url, ref, state, final }`. Example: [`events/topic.added.json`](../../packages/room-core/fixtures/v1/events/topic.added.json).

### `topic.updated`

`{ topic, title, url, ref }`. Example: [`events/topic.updated.json`](../../packages/room-core/fixtures/v1/events/topic.updated.json).

### `topic.moved`

`{ topic, index }`: the topic's new place in the list. Example: [`events/topic.moved.json`](../../packages/room-core/fixtures/v1/events/topic.moved.json).

### `topic.removed`

`{ topic }`. Example: [`events/topic.removed.json`](../../packages/room-core/fixtures/v1/events/topic.removed.json).

### `topic.activated`

`{ topic }`: the topic the room now estimates. Example: [`events/topic.activated.json`](../../packages/room-core/fixtures/v1/events/topic.activated.json).

### `topic.closed`

`{ topic, state }`: `done` or `skipped`. Example: [`events/topic.closed.json`](../../packages/room-core/fixtures/v1/events/topic.closed.json).

### `topic.decided`

`{ result }`: the topic's final value, as the result contract with `final`. Example: [`events/topic.decided.json`](../../packages/room-core/fixtures/v1/events/topic.decided.json).

### `seat.joined`

`{ seat: { index, name, avatar, role, presence } }`. Example: [`events/seat.joined.json`](../../packages/room-core/fixtures/v1/events/seat.joined.json).

### `seat.renamed`

`{ seat, name }`. Example: [`events/seat.renamed.json`](../../packages/room-core/fixtures/v1/events/seat.renamed.json).

### `seat.roleChanged`

`{ seat, role }`. Example: [`events/seat.roleChanged.json`](../../packages/room-core/fixtures/v1/events/seat.roleChanged.json).

### `seat.presenceChanged`

`{ seat, presence }`: `active`, `away`, `reconnecting` or `gone`. Example: [`events/seat.presenceChanged.json`](../../packages/room-core/fixtures/v1/events/seat.presenceChanged.json).

### `seat.left`

`{ seat }`. Example: [`events/seat.left.json`](../../packages/room-core/fixtures/v1/events/seat.left.json).

### `seat.kicked`

`{ seat, by }`. Example: [`events/seat.kicked.json`](../../packages/room-core/fixtures/v1/events/seat.kicked.json).

### `room.settingsChanged`

`{ settings: { deck, autoReveal, revealCountdown, timer } }`. Example: [`events/room.settingsChanged.json`](../../packages/room-core/fixtures/v1/events/room.settingsChanged.json).

### `room.titleChanged`

`{ name }`. Example: [`events/room.titleChanged.json`](../../packages/room-core/fixtures/v1/events/room.titleChanged.json).

### `room.accessChanged`

`{ access, code }`: the password is shown to every seat (`ARCHITECTURE.md`, Room model: the lock is not a vault). Example: [`events/room.accessChanged.json`](../../packages/room-core/fixtures/v1/events/room.accessChanged.json).

### `room.slugChanged`

`{ slug }`. Example: [`events/room.slugChanged.json`](../../packages/room-core/fixtures/v1/events/room.slugChanged.json).

## Fx

### `seat.react`

`{ emoji, to }`: an emoji thrown at a seat, or at the table when `to` is `null`. Example: [`frames/fx.json`](../../packages/room-core/fixtures/v1/frames/fx.json).

## Rejection reasons

| Reason | Meaning |
|-|-|
| `invalid` | the frame or its payload does not match its schema |
| `not_seated` | the sender holds no seat in this room |
| `forbidden` | a spectator tried what only a player may do |
| `seat_unknown` | the named seat is not in the room |
| `players_full` | 30 players are seated |
| `spectators_full` | 20 spectators are seated |
| `round_unknown` | the named round is not in the room |
| `round_closed` | the named round is revealed or has moved on |
| `not_revealed` | the named round is still voting |
| `no_votes` | a reveal without a vote |
| `card_unknown` | the round's deck has no such card, or a settle named a card without a number |
| `topic_unknown` | the named topic is not in the room |
| `topic_not_queued` | only a queued topic can be removed or moved on to |
| `topic_decided` | a vote again on a round the topic was decided on |
| `queue_full` | more than 200 open topics |
| `rate_limited` | the connection's token bucket is empty (burst 10, 5 per second) |
| `internal` | a bug: the room is unchanged |

## Close codes

| Code | Name | Meaning | Client does |
|-|-|-|-|
| 4001 | `version_unsupported` | protocol version not supported | prompt a reload |
| 4002 | `draining` | server draining, room moves | reconnect after a uniform 0 to 2 s delay |
| 4003 | `kicked` | kicked | show the notice, do not reconnect |
| 4004 | `expired` | live state expired or seat token unknown | rejoin as a new seat |
| 4005 | `access_required` | access code required or wrong | ask for the code, connect again with it |
| 4008 | `rate_limited` | rate limit exceeded | back off, reconnect |

## The view

`project(state, seat)` on the server builds it; `evolveView(view, event)` on the client keeps it current, and `withOwnVote(view, round, card)` adds the own card from the own `poker.vote`.

- `self`: this seat's index.
- `room`: `slug`, `name`, `access`, `code`, `settings`.
- `seats`: every seat with `index`, `name`, `avatar`, `role`, `presence`.
- `topics`: the list in order, each with `state` (`queued`, `active`, `done`, `skipped`) and `final` (`{ label, value, decidedBy, round }` or `null`).
- `activity`: `{ kind: "poker", current, rounds }`. `rounds` holds the latest revealed round of each topic and the current round, each with `id`, `topic`, `no`, `attempt`, `deck`, `state`, `startedAt`, `revealedAt`, `timerEndsAt`, `countdown` (`{ endsAt, cause }` or `null`), `armed` and `votes` (`{ seat, card }`). In a voting round `card` is `null` for every seat but this one.

## The result contract

One shape for history, exports, embed messages and webhooks, built by `buildRevealedResult` and `buildDecidedResult` (`@fpp/room-core/view` and `/server`). It never names a participant or a seat.

| Field | Meaning |
|-|-|
| `type` | `poker.revealed` or `topic.decided` |
| `v` | 1 |
| `id` | UUID v7, the same on every retry |
| `at` | ISO 8601 |
| `room` | `{ slug, name }` |
| `topic` | `{ id, title, url, source, externalId, externalKey, externalSite }` |
| `round` | `{ id, no, attempt, deck, voters, consensus, distribution: [{ label, value, count }] }`, the distribution in deck order, special cards last |
| `final` | `topic.decided` only: `{ label, value, decidedBy }`, `decidedBy` `agreed` (a unanimous reveal) or `settled` (a player chose) |

Examples: the `result` of [`events/poker.revealed.json`](../../packages/room-core/fixtures/v1/events/poker.revealed.json) and [`events/topic.decided.json`](../../packages/room-core/fixtures/v1/events/topic.decided.json).

## Limits

30 players and 20 spectators at the table (a `gone` seat does not count), 200 open topics, a reveal countdown of 0 to 10 s, 256 remembered command ids per room for repeats.
