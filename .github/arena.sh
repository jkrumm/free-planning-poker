#!/usr/bin/env bash
# CI's arena job: scores the reference entry and every entry under arena/entries this run changed, each with
# `make arena-score`, and fails when any scorecard fails. The change is read as .github/lanes.sh reads it.
set -euo pipefail

case "${EVENT:-}" in
    pull_request) base=$(git rev-parse --verify --quiet 'HEAD^1' || true) ;;
    push) base=${BEFORE:-} ;;
    *) base= ;;
esac

# A base that cannot be read scores every entry, as lanes.sh runs every lane.
if [ -n "$base" ] && [ -n "${base//0/}" ] &&
    { git cat-file -e "$base^{commit}" 2>/dev/null || git fetch --quiet --no-tags --depth=1 origin "$base"; }; then
    changed=$(git diff --name-only "$base" HEAD -- arena/entries | cut -d/ -f3 | sort -u)
    entries=$(printf '%s\n%s\n' reference "$changed" | grep . | sort -u)
else
    echo "arena: no readable base, scoring every entry"
    entries=$(find arena/entries -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
fi

failed=
for entry in $entries; do
    [ -f "arena/entries/$entry/index.tsx" ] || continue
    echo "arena: scoring $entry"
    make arena-score ENTRY="$entry" || failed="$failed $entry"
done
if [ -n "$failed" ]; then
    echo "arena: the floor failed for:$failed"
    exit 1
fi
