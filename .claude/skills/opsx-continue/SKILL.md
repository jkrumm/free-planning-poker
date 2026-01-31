---
name: opsx:continue
description: Continue working on an OpenSpec change by creating the next artifact one at a time.
compatibility: claude-code
context: main
---

# /opsx:continue

Continue working on a change by creating the next artifact.

**Input**: Optionally specify change name. If omitted, auto-select if only one active change exists.

## Steps

1. **Select change**

   If no name provided:
   - Run `openspec list --json` to get active changes
   - Auto-select if only one exists
   - Otherwise, use **AskUserQuestion tool** to let user choose

2. **Check current status**
   ```bash
   openspec status --change "<name>" --json
   ```

3. **Act based on status**

   **If all artifacts complete**: Congratulate and suggest `/opsx:apply` or archive.

   **If artifacts ready to create**:
   - Pick first artifact with `status: "ready"`
   - Get instructions:
     ```bash
     openspec instructions <artifact-id> --change "<name>" --json
     ```
   - Read dependency files for context
   - Create artifact using `template` as structure
   - Apply `context` and `rules` as constraints
   - STOP after creating ONE artifact

4. **Show progress**
   ```bash
   openspec status --change "<name>"
   ```

## Output

After each invocation:
- Which artifact was created
- Current progress (N/M complete)
- What artifacts are now unlocked
- Prompt: "Want to continue? Ask me to continue."

## Guardrails

- Create ONE artifact per invocation
- Always read dependency artifacts first
- Never skip artifacts or create out of order
- If context unclear, ask before creating
- Reference CLAUDE.md for error handling patterns
