# [Feature Name] - Cross-Component Change Specification

## Overview
[1-2 sentence description of what this feature does across multiple services]

## Services Affected

- [ ] Next.js App (port 3001)
- [ ] fpp-server (WebSocket, port 3003)
- [ ] fpp-analytics (FastAPI, port 3002)

## Change Summary

| Service | Component | Change Type | Files Affected |
|---------|-----------|-------------|----------------|
| Next.js | [area] | Add/Modify/Delete | [count] files |
| fpp-server | [area] | Add/Modify/Delete | [count] files |
| fpp-analytics | [area] | Add/Modify/Delete | [count] files |

## Implementation Sequence

**Critical:** Steps must be implemented in this order due to dependencies.

### Step 1: [Service Name] - [Component]

**Depends on:** None

**Files:**
- `[file path]`
- `[file path]`

**Changes:**
1. [Specific change description]
2. [Specific change description]

**Verification:**
```bash
[Command to verify this step works]
```

### Step 2: [Service Name] - [Component]

**Depends on:** Step 1

**Files:**
- `[file path]`
- `[file path]`

**Changes:**
1. [Specific change description]
2. [Specific change description]

**Verification:**
```bash
[Command to verify this step works]
```

### Step 3: [Service Name] - [Component]

**Depends on:** Step 1, Step 2

**Files:**
- `[file path]`
- `[file path]`

**Changes:**
1. [Specific change description]
2. [Specific change description]

**Verification:**
```bash
[Command to verify this step works]
```

## Data Flow

```
[User Action]
  → [Client Component]
    → [tRPC Call OR WebSocket Action]
      → [Next.js Server OR fpp-server]
        → [Database Write OR Memory Update]
          → [Broadcast OR Response]
            → [Client State Update]
              → [UI Re-render]
```

**Detailed Flow:**
1. User [does what action] in [component]
2. Client calls [tRPC endpoint OR triggerAction]
3. Server [validates, updates state, persists]
4. Server responds/broadcasts [what data]
5. Client updates [which Zustand store]
6. UI re-renders [which components]

## Deployment Sequence

**Which services need to be deployed first?**

### Phase 1: Deploy [Service]
**Why first:** [Reason - e.g., adds backward-compatible API that others will use]

**Deploy:**
```bash
[Deployment command or process]
```

**Verify:**
```bash
[Health check or smoke test]
```

### Phase 2: Deploy [Service]
**Why second:** [Reason - e.g., consumes new API from Phase 1]

**Deploy:**
```bash
[Deployment command or process]
```

**Verify:**
```bash
[Health check or smoke test]
```

### Phase 3: Deploy [Service]
**Why last:** [Reason - e.g., requires both previous services]

**Deploy:**
```bash
[Deployment command or process]
```

**Verify:**
```bash
[Health check or smoke test]
```

## Backwards Compatibility

- [ ] Old clients work with new server
- [ ] New clients work with old server
- [ ] Breaking change (requires coordinated deployment)

**If breaking change, mitigation:**
- [How to minimize downtime]
- [Feature flag strategy if applicable]
- [Gradual rollout plan if applicable]

**Compatibility Matrix:**

| Client Version | Server Version | Works? | Notes |
|----------------|----------------|--------|-------|
| Old | Old | ✅ | Current production |
| Old | New | [✅/❌] | [Notes] |
| New | Old | [✅/❌] | [Notes] |
| New | New | ✅ | Target state |

## Testing Strategy

### Unit Tests

**Next.js:**
- [ ] [Test description]
- [ ] [Test description]

**fpp-server:**
- [ ] [Test description]
- [ ] [Test description]

**fpp-analytics:**
- [ ] [Test description]
- [ ] [Test description]

### Integration Tests

**Test Scenario 1:** [Description]
1. [Step 1]
2. [Step 2]
3. [Expected result]

**Test Scenario 2:** [Description]
1. [Step 1]
2. [Step 2]
3. [Expected result]

### Manual Testing

**Setup:**
1. [Pre-requisite step 1]
2. [Pre-requisite step 2]

**Test Case 1:** [Description]
1. [Action step 1]
2. [Action step 2]
3. **Expected:** [What should happen]
4. **Verify:** [How to confirm it worked]

**Test Case 2:** [Description]
1. [Action step 1]
2. [Action step 2]
3. **Expected:** [What should happen]
4. **Verify:** [How to confirm it worked]

**Edge Cases:**
- [ ] [Edge case 1] - [Expected behavior]
- [ ] [Edge case 2] - [Expected behavior]

## Rollback Plan

**If deployment fails at Phase 1:**
```bash
[Rollback command or process]
```

**If deployment fails at Phase 2:**
```bash
[Rollback Phase 2]
[Consider if Phase 1 also needs rollback]
```

**If deployment fails at Phase 3:**
```bash
[Rollback Phase 3]
[Phase 1 and 2 can stay deployed if backward compatible]
```

### Data Cleanup

**If database changes need cleanup:**
```sql
-- Remove added data
DELETE FROM [table] WHERE [condition];

-- Drop added columns (if safe)
ALTER TABLE [table] DROP COLUMN [column];
```

**If Parquet files need cleanup:**
```bash
rm /app/data/fpp_[table_name].parquet
```

## Monitoring & Alerts

**What to monitor after deployment:**
- [ ] Error rates in Sentry (Next.js, fpp-server, fpp-analytics)
- [ ] WebSocket connection stability (fpp-server logs)
- [ ] Database query performance (slow query log)
- [ ] API response times (tRPC endpoints)
- [ ] Memory usage (fpp-server in-memory state)

**Alert thresholds:**
- Error rate > [X]% → Investigate immediately
- Response time > [X]ms → Check performance
- Connection drops > [X]/min → Check WebSocket stability

## Related Specs

- [Link to API spec]
- [Link to WebSocket spec]
- [Link to UI spec]
- [Link to database spec]
- [Link to state management spec]
