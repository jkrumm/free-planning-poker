# [Feature Name] - UI Component Specification

## Overview
[1-2 sentence description of what this component does]

## Component Location

**File:** `src/components/[category]/[component-name].tsx`

**Type:**
- [ ] Page Component (in /src/pages/)
- [ ] Container Component (logic + presentation)
- [ ] Presentational Component (pure UI)

## Props Interface

```typescript
type [ComponentName]Props = {
  propName: Type;
  onAction?: (param: Type) => void;
  // ... additional props
};
```

## State Management

### Local State

```typescript
const [localState, setLocalState] = useState<Type>(initialValue);
```

### Zustand Subscriptions

```typescript
// Selective subscriptions
const fieldName = use[Store]((state) => state.fieldName);
const action = use[Store]((state) => state.action);
```

### Actions

```typescript
// WebSocket actions
const { triggerAction } = useWebSocketRoom({ roomId, userId, username });

// tRPC mutations
const mutation = api.[router].[procedure].useMutation({
  onSuccess: (data) => {
    // Handle success
  },
  onError: (error) => {
    captureError(error, { component: '[ComponentName]', action: 'action' }, 'high');
  },
});
```

## Component Structure

```tsx
export function [ComponentName]({ propName }: [ComponentName]Props) {
  // 1. Hooks (state, stores, refs)
  const [localState, setLocalState] = useState(initialValue);
  const storeValue = useStore((state) => state.value);
  const ref = useRef<HTMLElement>(null);

  // 2. Derived state (useMemo)
  const computed = useMemo(() => {
    return expensiveComputation(localState, storeValue);
  }, [localState, storeValue]);

  // 3. Event handlers (useCallback)
  const handleInteraction = useCallback(() => {
    // Handle user interaction
  }, [dependencies]);

  // 4. Effects
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [dependencies]);

  // 5. Early returns (loading, error states)
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  // 6. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

## User Interactions

### [Interaction Name]

**Trigger:** [What user does - click, type, hover, etc.]

**Handler:**
```typescript
const handleInteraction = useCallback(() => {
  // 1. Validation
  if (!isValid) {
    setError('Validation error');
    return;
  }

  // 2. Trigger action or mutation
  triggerAction({ action: 'actionName', userId, roomId, param: value });
  // OR
  mutation.mutate({ param: value });

  // 3. Optimistic update (optional)
  setLocalState(optimisticValue);
}, [dependencies]);
```

**Feedback:**
- Loading state: [Spinner, disabled button, skeleton, etc.]
- Success state: [Toast, animation, confetti, etc.]
- Error state: [Error message, toast, red border, etc.]

## Styling

**Framework:**
- [ ] Tailwind CSS
- [ ] Mantine Components
- [ ] Custom CSS

**Key Classes/Components:**
```tsx
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
  {/* or */}
  <MantineButton variant="filled" color="blue" onClick={handleClick}>
    Button
  </MantineButton>
</div>
```

**Responsive Design:**
- Mobile: `[Tailwind classes or breakpoints]`
- Tablet: `[Tailwind classes or breakpoints]`
- Desktop: `[Tailwind classes or breakpoints]`

## Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader labels present (aria-label, aria-describedby)
- [ ] Focus management correct (autofocus, focus trap)
- [ ] ARIA attributes used appropriately (aria-live, role, etc.)
- [ ] Color contrast meets WCAG AA standards
- [ ] Interactive elements have visible focus states

**ARIA Attributes:**
```tsx
<button
  aria-label="[Descriptive label]"
  aria-pressed={isActive}
  aria-disabled={isDisabled}
  onClick={handleClick}
>
  {label}
</button>
```

## Performance

### Memoization

**Expensive Computations:**
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(dependency);
}, [dependency]);
```

**Callback Memoization:**
```typescript
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### Conditional Rendering

**Lazy Loading:**
```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<LoadingSpinner />}>
  {showHeavy && <HeavyComponent />}
</Suspense>
```

**Virtualization (for long lists):**
```tsx
// Use react-window or similar for 100+ items
```

## Testing Checklist

### Rendering
- [ ] Component renders without errors
- [ ] Props are passed correctly
- [ ] Conditional rendering works (loading, error, empty states)

### User Interactions
- [ ] Click handlers trigger correct actions
- [ ] Form submissions work
- [ ] Input changes update state
- [ ] Keyboard interactions work

### State Management
- [ ] Local state updates correctly
- [ ] Zustand store updates trigger re-renders
- [ ] Optimistic updates work
- [ ] Rollback on error works (if applicable)

### Integration
- [ ] WebSocket actions trigger
- [ ] tRPC mutations succeed
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Success feedback works (toast, animation, etc.)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus management correct
- [ ] Color contrast sufficient

### Performance
- [ ] No unnecessary re-renders (check with React DevTools)
- [ ] Expensive computations are memoized
- [ ] Large lists are virtualized (if applicable)

## Related Specs

- [Link to WebSocket action spec]
- [Link to tRPC API spec]
- [Link to state management spec]
- [Link to related UI components]
