# [Feature Name] - State Management Specification

## Overview
[1-2 sentence description of what state is being managed]

## State Location

**Store:** `src/store/[store-name].store.ts`

**State Type:**
- [ ] Real-time (room.store) - Synced via WebSocket
- [ ] Persistent (local-storage.store) - Synced via localStorage

## State Shape

```typescript
interface [StateName]State {
  fieldName: Type;
  // ... additional fields

  // Actions
  setFieldName: (value: Type) => void;
  resetState: () => void;
}
```

## State Actions

### [actionName]

**Purpose:** [What this action does]

**Implementation:**
```typescript
[actionName]: (param: Type) => set((state) => ({
  fieldName: computeNewValue(param, state),
})),
```

**Triggers:**
- [When is this action called]
- [What components call it]
- [What events trigger it (WebSocket message, user interaction, etc.)]

### resetState

**Purpose:** Clear/reset state to initial values

**Implementation:**
```typescript
resetState: () => set({
  fieldName: initialValue,
  // ... reset all fields
}),
```

**Triggers:**
- [When state needs to be cleared]
- [Component unmount, logout, room leave, etc.]

## Selectors

### Component Subscriptions

```typescript
// ✅ Good - selective subscription (only re-renders when fieldName changes)
const fieldName = use[Store]((state) => state.fieldName);

// ✅ Good - multiple specific fields
const { field1, field2 } = use[Store]((state) => ({
  field1: state.field1,
  field2: state.field2,
}));

// ❌ Bad - subscribes to entire store (re-renders on ANY state change)
const state = use[Store]();
```

### Computed Values

If derived state is needed:

```typescript
// Option 1: Compute in component
const computedValue = use[Store]((state) => {
  return computeFromState(state.fieldA, state.fieldB);
});

// Option 2: useMemo in component
const users = useRoomStore((state) => state.users);
const activeUsers = useMemo(
  () => users.filter(u => !u.isSpectator),
  [users]
);
```

## Persistence

**For local-storage.store only:**

**localStorage Key:** `[key-name]`

**Version:** `[number]`

**Migration Strategy:**
```typescript
persist(
  (set) => ({ /* state */ }),
  {
    name: '[key-name]',
    version: [number],
    migrate: (persistedState, version) => {
      if (version < [newVersion]) {
        // Migration logic
        return { ...persistedState, newField: defaultValue };
      }
      return persistedState;
    },
  }
)
```

## Synchronization

**For room.store only:**

**Update Trigger:** WebSocket message from fpp-server

**Update Pattern:**
```typescript
// In src/hooks/useWebSocketRoom.ts
onMessage: (event) => {
  const roomDto = JSON.parse(event.data);
  const room = RoomClient.fromJson(roomDto);

  // Update entire room state
  updateRoomState(room);
};

// updateRoomState implementation in room.store.ts
updateRoomState: (room: RoomClient) => set({
  id: room.id,
  startedAt: room.startedAt,
  lastUpdated: room.lastUpdated,
  users: room.users,
  isFlipped: room.isFlipped,
  isAutoFlip: room.isAutoFlip,
}),
```

## Component Integration

### Reading State

```typescript
// In functional component
const fieldName = use[Store]((state) => state.fieldName);

// Effect dependency
useEffect(() => {
  // Do something when fieldName changes
}, [fieldName]);
```

### Updating State

```typescript
// Get action
const setFieldName = use[Store]((state) => state.setFieldName);

// Call action
const handleClick = () => {
  setFieldName(newValue);
};
```

### Resetting State

```typescript
// On component unmount
useEffect(() => {
  return () => {
    resetState();
  };
}, []);
```

## Testing Checklist

### Initialization
- [ ] State initializes with correct default values
- [ ] localStorage loads persisted state (if applicable)
- [ ] Version migration works (if applicable)

### Actions
- [ ] Actions update state as expected
- [ ] Actions don't mutate state directly (immutable updates)
- [ ] Multiple actions can be batched

### Selectors
- [ ] Selectors return correct values
- [ ] Components re-render only when subscribed state changes
- [ ] Computed selectors work correctly

### Persistence
- [ ] State persists to localStorage (if applicable)
- [ ] State hydrates on page reload (if applicable)
- [ ] Migration handles version changes (if applicable)

### Synchronization
- [ ] WebSocket messages update store (if applicable)
- [ ] Updates trigger component re-renders (if applicable)
- [ ] Out-of-order messages handled gracefully (if applicable)

## Related Specs

- [Link to WebSocket action that updates this state]
- [Link to UI components that consume this state]
- [Link to API endpoints that initialize this state]
