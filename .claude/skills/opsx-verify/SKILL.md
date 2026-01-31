---
name: opsx:verify
description: Verify implementation matches change artifacts. Validates completeness, correctness, and coherence before archiving.
compatibility: claude-code
context: main
---

# /opsx:verify

Verify that implementation matches the change artifacts.

**Input**: Optionally specify change name.

## Steps

1. **Select change**

   If no name provided:
   - Run `openspec list --json`
   - Use **AskUserQuestion tool** to let user select

2. **Load artifacts**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```
   Read all files from `contextFiles`.

3. **Verify Completeness**

   **Task Completion:**
   - Parse tasks.md for `- [ ]` (incomplete) vs `- [x]` (complete)
   - Count and report incomplete tasks

   **Spec Coverage:**
   - For each requirement in delta specs
   - Search codebase for implementation evidence
   - Report unimplemented requirements

4. **Verify Correctness**

   **Requirement Mapping:**
   - For each requirement, find implementation
   - Note file paths and line ranges
   - Report divergences

   **Scenario Coverage:**
   - For each scenario in specs
   - Check if code handles the case
   - Report uncovered scenarios

5. **Verify Coherence**

   **Design Adherence:**
   - If design.md exists, extract key decisions
   - Verify implementation follows decisions
   - Report contradictions

   **Error Handling:**
   - Verify new code follows CLAUDE.md error handling patterns
   - Check for proper Sentry integration

## Output Format

```
## Verification Report: <change-name>

### Summary
| Dimension    | Status              |
|--------------|---------------------|
| Completeness | X/Y tasks, N reqs   |
| Correctness  | M/N reqs covered    |
| Coherence    | Followed/Issues     |

### CRITICAL (Must fix)
- Incomplete task: <description>
- Missing requirement: <name>

### WARNING (Should fix)
- Spec divergence: <details>
- Uncovered scenario: <name>

### SUGGESTION (Nice to fix)
- Pattern inconsistency: <details>

### Assessment
[Ready for archive / Fix X critical issues first]
```

## Guardrails

- Every issue must have specific, actionable recommendation
- Prefer SUGGESTION over WARNING for uncertain issues
- Note which checks were skipped and why
- Reference file:line for all issues
