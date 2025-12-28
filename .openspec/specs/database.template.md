# [Feature Name] - Database Schema Specification

## Overview
[1-2 sentence description of what database changes are needed]

## Schema Changes

**File:** `src/server/db/schema.ts`

**Type:**
- [ ] New Table
- [ ] Add Columns
- [ ] Modify Columns
- [ ] Add Index
- [ ] Add Foreign Key
- [ ] Delete Column/Table

## New Table Definition (if applicable)

```typescript
export const [tableName] = mysqlTable('[table_name]', {
  id: serial('id').primaryKey(),
  fieldName: varchar('field_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  // ... additional columns
});
```

## Column Modifications (if applicable)

```typescript
// Before
existingField: varchar('existing_field', { length: 100 }),

// After
existingField: varchar('existing_field', { length: 255 }).notNull(),
```

## Relationships

```typescript
// Foreign key
roomId: int('room_id').notNull().references(() => rooms.id),

// Drizzle relation
export const [tableName]Relations = relations([tableName], ({ one, many }) => ({
  // one-to-one or many-to-one
  room: one(rooms, {
    fields: [[tableName].roomId],
    references: [rooms.id],
  }),

  // one-to-many
  items: many([relatedTable]),
}));
```

## Indexes

```typescript
// In table definition
(table) => ({
  roomIdIdx: index('room_id_idx').on(table.roomId),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
  // Composite index
  roomUserIdx: index('room_user_idx').on(table.roomId, table.userId),
})
```

**Index Rationale:**
- `room_id_idx`: [Why this index is needed - e.g., frequent WHERE roomId = X queries]
- `created_at_idx`: [Why this index is needed - e.g., ORDER BY createdAt DESC]

## Migration

### Generate Migration

```bash
npm run db:generate
```

**Expected Output:**
```
Drizzle Kit: Generated migrations/0001_[timestamp]_[description].sql
```

### Review Migration File

```sql
-- Expected SQL in migrations/0001_[timestamp]_[description].sql
ALTER TABLE [table_name] ADD COLUMN [column_name] [type];
CREATE INDEX [index_name] ON [table_name]([column]);
```

**Manual Review Checklist:**
- [ ] SQL syntax is correct
- [ ] Column types are appropriate
- [ ] Indexes are created
- [ ] Foreign keys are set up
- [ ] No data loss (if modifying existing columns)

### Apply Migration

```bash
npm run db:migrate
```

**Verify in Database:**
```sql
DESCRIBE [table_name];
SHOW INDEX FROM [table_name];
```

## Data Access Patterns

### Query Examples

```typescript
// Select (findFirst)
const result = await db.query.[tableName].findFirst({
  where: eq([tableName].id, id),
  with: {
    relatedTable: true,  // Include relations
  },
});

// Select (findMany)
const results = await db.query.[tableName].findMany({
  where: and(
    eq([tableName].fieldA, valueA),
    gt([tableName].fieldB, valueB)
  ),
  orderBy: desc([tableName].createdAt),
  limit: 10,
});

// Insert
await db.insert([tableName]).values({
  fieldName: value,
  createdAt: new Date(),
});

// Insert many
await db.insert([tableName]).values([
  { fieldName: value1 },
  { fieldName: value2 },
]);

// Update
await db.update([tableName])
  .set({ fieldName: newValue, updatedAt: new Date() })
  .where(eq([tableName].id, id));

// Delete
await db.delete([tableName])
  .where(eq([tableName].id, id));
```

### Transaction Example

```typescript
await db.transaction(async (tx) => {
  // All operations within transaction
  await tx.insert([tableName]).values({ ... });
  await tx.update([relatedTable]).set({ ... });

  // If any operation fails, all are rolled back
});
```

## Analytics Impact

Does this change affect analytics?

- [ ] Yes - Update `fpp-analytics/update_readmodel.py`
- [ ] No - Analytics unchanged

**If yes, specify:**

### Add to Sync Script

```python
# In fpp-analytics/update_readmodel.py
TABLES = {
    # ... existing
    'fpp_[table_name]': 'id',  # or 'created_at' if no auto-increment
}
```

### Create Calculation

```python
# fpp-analytics/calculations/[feature].py
import polars as pl
from pathlib import Path
from config import DATA_DIR

def calc_[metric]() -> dict:
    """Calculate [metric] from new table."""
    data_dir = Path(DATA_DIR)
    df = pl.read_parquet(data_dir / "fpp_[table_name].parquet")

    result = df.select([
        pl.col("column").count().alias("total")
    ]).row(0, named=True)

    return {"total": result["total"] or 0}
```

## Rollback Plan

**If migration fails:**

```sql
-- Rollback SQL
ALTER TABLE [table_name] DROP COLUMN [column_name];
DROP INDEX [index_name] ON [table_name];
DROP TABLE [table_name];
```

**If data corruption occurs:**
1. Stop application
2. Restore from backup
3. Review migration script
4. Fix and re-apply

## Testing Checklist

### Migration
- [ ] Migration generates without errors
- [ ] Migration applies without errors
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Rollback SQL tested

### Schema
- [ ] Column types are correct
- [ ] NOT NULL constraints work
- [ ] DEFAULT values work
- [ ] Foreign keys enforce correctly
- [ ] Indexes exist (check with `SHOW INDEX`)

### Data Access
- [ ] Query patterns work as expected
- [ ] Insert/Update/Delete operations work
- [ ] Transactions commit correctly
- [ ] Transactions rollback on error
- [ ] Relations load correctly (with/include)

### Performance
- [ ] Indexes improve query performance (check EXPLAIN)
- [ ] No slow queries introduced
- [ ] Full table scans avoided

### Analytics
- [ ] Sync script syncs correctly (if applicable)
- [ ] Parquet files created (if applicable)
- [ ] Calculations work (if applicable)

## Related Specs

- [Link to tRPC API that uses this schema]
- [Link to analytics calculation that reads this table]
- [Link to WebSocket action that triggers persistence]
