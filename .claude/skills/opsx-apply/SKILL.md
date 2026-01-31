---
name: opsx:apply
description: Implement tasks from an OpenSpec change. Works through the task list sequentially.
compatibility: claude-code
context: main
---

# /opsx:apply

Implement tasks from an OpenSpec change.

**Input**: Optionally specify change name. If omitted, auto-select if only one active change exists.

## Steps

1. **Select change**

   If no name provided:
   - Infer from conversation context
   - Auto-select if only one active change
   - Otherwise, use **AskUserQuestion tool**

2. **Get apply instructions**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   Handle states:
   - If `state: "blocked"`: suggest using `/opsx:continue`
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed

3. **Read context files**

   Read all files listed in `contextFiles`:
   - proposal.md (why and what)
   - specs/ (requirements)
   - design.md (technical decisions)
   - tasks.md (implementation checklist)

4. **Show current progress**

   Display:
   - Progress: "N/M tasks complete"
   - Remaining tasks overview

5. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on
   - Make code changes required
   - Follow error handling patterns from CLAUDE.md
   - Mark task complete: `- [ ]` → `- [x]`
   - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals design issue → suggest updating artifacts
   - Error encountered → report and wait

6. **On completion, show status**

   Display:
   - Tasks completed this session
   - Overall progress
   - If all done: suggest `/opsx:archive`

## Output Format

```
## Implementing: <change-name>

Working on task 3/7: <task description>
[...implementation...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation...]
✓ Task complete
```

## Guardrails

- Keep going through tasks until done or blocked
- Follow CLAUDE.md error handling patterns for all code
- If task ambiguous, pause and ask
- Keep changes minimal and scoped to each task
- Update task checkbox immediately after completing
