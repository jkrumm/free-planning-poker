# [Feature Name] - WebSocket Action Specification

## Overview
[1-2 sentence description of what this WebSocket action does]

## Action Definition

**Action Type:** `'[actionName]'`

**File:** `fpp-server/src/room.actions.ts`

## Action Interface

```typescript
export interface [ActionName]Action {
  action: '[actionName]';
  userId: string;
  roomId: number;
  // ... additional fields
}
```

## TypeBox Schema

```typescript
export const C[ActionName]ActionSchema = Type.Object({
  action: Type.Literal('[actionName]'),
  userId: Type.String({ minLength: 21, maxLength: 21 }),
  roomId: Type.Integer({ minimum: 1 }),
  // ... additional fields with validation
  // Example: estimation: Type.String({ maxLength: 50 }),
});
```

**Add to Action Union:**
```typescript
// In room.actions.ts
export type Action =
  | JoinAction
  | LeaveAction
  | [ActionName]Action  // ADD HERE
  | ...;

export const CActionSchema = Type.Union([
  CJoinActionSchema,
  CLeaveActionSchema,
  C[ActionName]ActionSchema,  // ADD HERE
  ...
]);
```

## Handler Implementation

**File:** `fpp-server/src/message.handler.ts`

```typescript
case '[actionName]': {
  // 1. Get room
  const room = roomState.rooms.get(action.roomId);
  if (!room) return;

  // 2. Get user (if needed)
  const user = room.getUser(action.userId);
  if (!user) return;

  // 3. Update state
  [describe state changes - be specific]
  // Example: user.estimation = action.estimation;
  //          room.isFlipped = false;

  // 4. Broadcast
  roomState.sendToEverySocketInRoom(action.roomId);
  break;
}
```

## State Changes

**RoomServer** (`fpp-server/src/room.entity.ts`):
- [What room properties change]
- [What computed properties are affected (isFlippable, status, etc.)]

**UserServer** (`fpp-server/src/room.entity.ts`):
- [What user properties change]
- [What user status changes (pending → estimated → spectator)]

## Broadcast Behavior

- [x] Broadcasts to all users in room
- [ ] Broadcasts only to specific users (rare)
- [ ] No broadcast (very rare)

**What is broadcast:**
```typescript
// Full room DTO via room.toStringifiedJson()
{
  id: number,
  startedAt: number,
  lastUpdated: number,
  users: UserDTO[],
  isFlipped: boolean,
  isAutoFlip: boolean,
  status: 'estimating' | 'flippable' | 'flipped'
}
```

## Client Integration

```typescript
// Trigger action
triggerAction({
  action: '[actionName]',
  userId,
  roomId,
  fieldName: value,
});

// Zustand store update (automatic via WebSocket message)
// src/hooks/useWebSocketRoom.ts handles this
onMessage: (event) => {
  const roomDto = JSON.parse(event.data);
  const room = RoomClient.fromJson(roomDto);
  updateRoomState(room); // Updates Zustand store
};

// Component re-renders (selective subscription)
const users = useRoomStore((state) => state.users);
const isFlipped = useRoomStore((state) => state.isFlipped);
```

## Persistence

Does this action require database persistence?

- [ ] Yes - Call Next.js tRPC endpoint after action
- [ ] No - Ephemeral state only (most actions)

**If yes, specify tRPC endpoint:**
```typescript
// In fpp-server/src/message.handler.ts
await fetch(`${process.env.TRPC_URL}/[router].[procedure]`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* data */ }),
});
```

## Auto-Flip Behavior

Does this action affect auto-flip logic?

- [ ] Yes - Triggers `room.autoFlip()` check
- [ ] No

**If yes, explain:**
- [When does room become flippable after this action?]
- [Does this action clear estimations?]

## Testing Checklist

### Validation
- [ ] Action validates correctly (TypeBox schema)
- [ ] Invalid actions are rejected (missing fields, wrong types)

### State Updates
- [ ] Room state updates as expected
- [ ] User state updates as expected
- [ ] Computed properties update (isFlippable, status)

### Broadcasting
- [ ] Broadcast reaches all users in room
- [ ] Users in different rooms don't receive broadcast
- [ ] Client receives and applies update correctly

### Edge Cases
- [ ] Handles missing room gracefully (no crash)
- [ ] Handles missing user gracefully (no crash)
- [ ] Handles duplicate actions gracefully (idempotent)

### Integration
- [ ] Persistence works (if applicable)
- [ ] Auto-flip triggers (if applicable)
- [ ] Sentry captures errors correctly

## Related Specs

- [Link to client UI spec that triggers this action]
- [Link to database persistence spec (if applicable)]
- [Link to related WebSocket actions]
- [Link to state management spec for affected stores]
