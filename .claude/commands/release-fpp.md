---
description: "Create a release with AI-generated summary for GitHub release notes"
arguments:
  - name: version
    description: "Optional version hint (patch/minor/major). Default: let release-it auto-detect"
    required: false
---

# Release Command for Free Planning Poker

Create releases with AI-enhanced GitHub release notes while keeping CHANGELOG.md clean with conventional changelog only.

## Prerequisites

- Must be on `master` branch
- Working directory must be clean (no uncommitted changes)
- `gh` CLI authenticated

## Workflow

### Phase 1: Pre-flight Checks

```bash
# Verify branch
git branch --show-current  # Must be master

# Verify clean state
git status --porcelain  # Must be empty

# Get last tag
git describe --tags --abbrev=0
```

### Phase 2: Analyze Changes

Run these commands to understand the release scope:

```bash
# Get commits since last tag
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# Get commit details for AI analysis
git log --pretty=format:"%s%n%b" $(git describe --tags --abbrev=0)..HEAD
```

Categorize commits by type:
- `feat:` → Features (user-facing improvements)
- `fix:` → Bug Fixes
- `refactor:` → Code Refactoring
- `docs:` → Documentation
- `ci:` → CI/CD improvements
- `chore:` → Maintenance

### Phase 3: Generate AI Summary

Based on the commits, generate:

1. **Release Title** (catchy, ~5-10 words)
   - Format: `<version> - <theme>`
   - Example: `8.3.0 - Observability & Polish`

2. **Executive Summary** (2-3 sentences)
   - What this release brings
   - Key improvements for users/developers

3. **Key Highlights** (4-6 bullet points)
   - Major features and improvements
   - Focus on impact, not implementation details

**Output Format:**
```markdown
## <Title>

<Executive summary paragraph>

### Key Highlights
- Highlight 1
- Highlight 2
- ...

---

<Conventional changelog will appear below>
```

### Phase 4: Execute Release

Run release-it interactively:

```bash
npm run release
```

**Interactive prompts:**
1. Version bump selection (patch/minor/major or specific version)
2. Changelog preview confirmation
3. Git commit/tag confirmation
4. GitHub release confirmation

Wait for release-it to complete. It will:
- Update `CHANGELOG.md` with conventional commits
- Create git commit: `chore: release v<version>`
- Create git tag
- Create GitHub release with auto-generated notes

### Phase 5: Enhance GitHub Release

After release-it completes, update GitHub release with AI summary:

```bash
# Get the new version tag
NEW_TAG=$(git describe --tags --abbrev=0)

# Fetch current release notes
gh release view $NEW_TAG --json body -q .body > /tmp/release-notes.md

# Prepend AI summary to release notes
# (Create new file with AI summary + existing notes)

# Update the release
gh release edit $NEW_TAG --notes-file /tmp/enhanced-release-notes.md
```

**Final release format:**
```markdown
## 8.3.0 - Observability & Polish

This release brings unified structured logging across all services...

### Key Highlights
- Unified JSON logging with Logdy integration
- Centralized error handling with CustomTRPCError
- ...

---

## What's Changed
### Features
* feat: ... by @jkrumm in #XX
...

### Bug Fixes
* fix: ... by @jkrumm in #XX
...
```

### Phase 6: Verify

```bash
# Show the release
gh release view $NEW_TAG

# Open in browser
gh release view $NEW_TAG --web
```

## Error Handling

- **Not on master**: Abort, ask user to switch branches
- **Uncommitted changes**: Abort, ask user to commit or stash
- **release-it fails**: Check error, may need to resolve manually
- **gh release edit fails**: Provide manual edit URL

## Notes

- CHANGELOG.md remains clean (conventional changelog only)
- AI summary only appears in GitHub release notes
- release-it handles version bumping, tagging, and publishing
- This command guides the process but requires user interaction for version selection
