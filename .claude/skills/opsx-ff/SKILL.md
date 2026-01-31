---
name: opsx:ff
description: Fast-forward through OpenSpec artifact creation. Generates all artifacts (proposal, specs, design, tasks) in one go.
compatibility: claude-code
context: main
---

# /opsx:ff

Fast-forward through artifact creation - generate everything needed to start implementation.

**Input**: Change name (kebab-case) OR description of what to build.

## Steps

1. **If no clear input, ask what to build**

   Use **AskUserQuestion tool** to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   Derive kebab-case name from description.

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

3. **Get artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse JSON for `applyRequires` (artifacts needed before implementation).

4. **Create artifacts in sequence until apply-ready**

   For each artifact with `status: "ready"`:

   a. Get instructions:
      ```bash
      openspec instructions <artifact-id> --change "<name>" --json
      ```

   b. Read dependency files for context

   c. Create artifact using `template` as structure
      - Apply `context` and `rules` as constraints (don't copy them to file)
      - Reference `openspec/config.yaml` for project context
      - Reference `CLAUDE.md` for error handling patterns

   d. Show progress: "✓ Created <artifact-id>"

5. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

## Output

After all artifacts created, summarize:
- Change name and location
- List of artifacts created
- "All artifacts created! Ready for implementation."
- Prompt: "Run `/opsx:apply` to start implementing the tasks."

## Artifact Guidelines

For **spec-driven schema** (proposal → specs → design → tasks):
- **proposal.md**: Why this change, what it affects, which services
- **specs/<capability>/spec.md**: Requirements with scenarios
- **design.md**: Technical decisions, cross-service impacts
- **tasks.md**: Implementation checklist

## Guardrails

- Create ALL artifacts needed for implementation
- Always read dependency artifacts before creating new ones
- If context is unclear, ask the user
- Reference CLAUDE.md for Sentry/error handling patterns
- Reference ARCHITECTURE.md for system design
