# Test ids of the room

The `data-testid` of every interactive element and every seat of the plain room (`apps/room`). Stage 2 keeps these ids when it gives the room a look: an end-to-end test selects by them and by role, never by text, because the text is in the user's language. `apps/room/test/rules.test.ts` fails when this list and the source differ.

Words follow `docs/v9/UX.md`: seat, card, reveal, final value, next topic, topic, topic queue, access code, invite link.

| Id | What |
|-|-|
| **Page** | |
| `home` | header link to /room |
| `language` | the language select in the header; its value is a language code |
| `status` | the connection status text; `data-status` is the client status (`connecting`, `locked`, `live`, `reconnecting`, ...) |
| `notice` | a command the room refused or that went nowhere offline |
| **Lobby (/room)** | |
| `start` | link: start a room |
| `join-address` | field: room number or name |
| `join` | button: open that room |
| `join-invalid` | alert: not a valid address |
| `recent` | list of rooms this device visited |
| `recent-room` | one of them; `data-slug` |
| `recent-remove` | button: drop it from the list |
| `back-to-rooms` | link on the page for an address the app has no page for |
| **Creating (/room/new)** | |
| `new-creating` | status while the room is created |
| `new-failed` | alert: it failed |
| `new-retry` | button: try again |
| **Entering a room** | |
| `name-input` | field: your name (a device without one) |
| `join-room` | button: take a seat |
| `code-input` | field: the room password (status `locked`) |
| `code-submit` | button: enter the room |
| `code-refused` | alert: wrong password |
| `accept-new-room` | button: take the address as a new room (status `changed-hands`) |
| `rejoin` | button: take a seat again (status `kicked` or `gone`) |
| `reload` | button: reload (status `reload-required`) |
| **Seats** | |
| `seats` | the list |
| `seat` | one seat; `data-seat` (index), `data-role`, `data-presence`, `data-state` (`thinking`, `voted`, `revealed`, `spectator`), `data-self` |
| `seat-name`, `seat-role`, `seat-presence`, `seat-vote` | the parts of a seat; `seat-vote` shows a card only after the reveal (and your own card to you) |
| `kick` | button on every seat but your own: remove that seat |
| **Round** | |
| `round` | the round; `data-state` is `voting` or `revealed` |
| `round-topic` | the topic being estimated |
| `vote-meter` | "n of m players voted" |
| `deck` | the cards of the round |
| `card` | one card button; `data-card` is its label; `aria-pressed` for your vote |
| `clear-vote` | button: take your vote back |
| `reveal` | button: reveal the cards |
| `countdown` | text: the automatic reveal is coming |
| `cancel-reveal` | button: stop it |
| `result`, `result-card` | the votes after the reveal, one per card; `data-card` |
| `final-values` | the row of cards that can be the final value |
| `final-value` | one of them; `data-card` |
| `final-value-result` | the topic's final value; `data-card` |
| `revote` | button: vote again on the same topic |
| `next-topic` | button: close this topic and move on |
| **Topics** | |
| `topic-queue` | the section |
| `topic-paste` | textarea: topics, one per line |
| `topic-add` | button: add them |
| `topic` | one topic; `data-state` (`queued`, `active`, `done`, `skipped`), `data-topic` (id) |
| `topic-name`, `topic-state`, `topic-final` | its title, its state, its final value (`data-card`) |
| `topic-title` | field: rename |
| `topic-rename` | button: save the title |
| `topic-up`, `topic-down` | buttons: move it |
| `topic-activate` | button: estimate this one next |
| `topic-remove` | button: remove it |
| **Your seat** | |
| `rename-input`, `rename` | field and button: change your name |
| `role-toggle` | button: become a spectator or a player |
| `leave` | button: leave the room |
| **Settings** | |
| `setting-deck` | select: the deck |
| `auto-reveal` | checkbox: reveal when everyone has voted |
| `setting-countdown` | select: the wait before it |
| `setting-timer` | select: the round timer |
| `room-title`, `room-title-save` | field and button: the room's title |
| **Invite, lock, address** | |
| `invite-link` | readonly field: the link; in a locked room it ends in `#<password>` (`encodeURIComponent`) |
| `access-code` | the password of a locked room, to read out |
| `access-state` | text; `data-access` is `open` or `locked` |
| `lock-code`, `lock-typed` | field and button: lock with a typed password |
| `lock-generated` | button: lock with a generated password |
| `sign-out` | checkbox: remove everyone seated now |
| `unlock` | button: unlock |
| `book-name`, `book-name-submit` | field and button: book a name |
| `room-address` | text: the room's primary address |
| `access-outcome` | status of the last lock or name request; `data-outcome` |
