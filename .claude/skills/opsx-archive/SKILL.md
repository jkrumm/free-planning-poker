---
name: opsx:archive
description: Archive a completed change after implementation. Moves change to archive with date prefix.
compatibility: claude-code
context: main
---

# /opsx:archive

Archive a completed change.

**Input**: Optionally specify change name.

## Steps

1. **Select change**

   If no name provided:
   - Run `openspec list --json`
   - Use **AskUserQuestion tool** to let user select
   - Do NOT auto-select

2. **Check artifact completion**
   ```bash
   openspec status --change "<name>" --json
   ```

   If incomplete artifacts:
   - Display warning
   - Ask user to confirm proceeding

3. **Check task completion**

   Read tasks.md and count incomplete tasks.

   If incomplete tasks:
   - Display warning with count
   - Ask user to confirm proceeding

4. **Perform archive**

   Create archive directory if needed:
   ```bash
   mkdir -p openspec/archive
   ```

   Generate target name: `YYYY-MM-DD-<change-name>`

   Move change to archive:
   ```bash
   mv openspec/changes/<name> openspec/archive/YYYY-MM-DD-<name>
   ```

5. **Display summary**

## Output

```
## Archive Complete

**Change:** <change-name>
**Archived to:** openspec/archive/YYYY-MM-DD-<name>/
**Tasks:** X/Y complete

All done! Change has been archived.
```

## Guardrails

- Always prompt for change selection if not provided
- Don't block archive on warnings - just inform and confirm
- Show clear summary of what happened
