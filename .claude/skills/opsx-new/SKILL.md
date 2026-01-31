---
name: opsx:new
description: Start a new OpenSpec change. Use when you want to create a new feature with structured specifications.
compatibility: claude-code
context: main
---

# /opsx:new

Start a new change using the OpenSpec spec-driven workflow.

**Input**: Change name (kebab-case) OR description of what to build.

## Steps

1. **If no clear input, ask what to build**

   Use **AskUserQuestion tool** to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   Derive kebab-case name from description (e.g., "add timer feature" → `add-timer-feature`).

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates `openspec/changes/<name>/` with scaffolded structure.

3. **Show artifact status**
   ```bash
   openspec status --change "<name>"
   ```
   Shows which artifacts need to be created (proposal, specs, design, tasks).

4. **Get instructions for first artifact (proposal)**
   ```bash
   openspec instructions proposal --change "<name>"
   ```
   Shows template and context for creating the proposal.

5. **STOP and wait for direction**

## Output

After steps complete, summarize:
- Change name and location
- Current status (0/N artifacts complete)
- Template for proposal artifact
- Prompt: "Ready to create the proposal? Describe what this change is about."

## Guardrails

- Do NOT create artifacts yet - just show instructions
- If name exists, suggest continuing that change instead
- Reference `openspec/config.yaml` for project context
- Reference `CLAUDE.md` for error handling patterns
