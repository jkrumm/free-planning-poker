#!/usr/bin/env bash
# CI's arena job: scores the reference entry and every entry under arena/entries this run changed, each with
# `make arena-score`, and fails when any scorecard fails. The change is read as .github/lanes.sh reads it.
set -euo pipefail

case "${EVENT:-}" in
    pull_request) base=$(git rev-parse --verify --quiet 'HEAD^1' || true) ;;
    push) base=${BEFORE:-} ;;
    *) base= ;;
esac

entries=reference
if [ -n "$base" ] && git cat-file -e "$base^{commit}" 2>/dev/null; then
    changed=$(git diff --name-only "$base" HEAD -- arena/entries | cut -d/ -f3 | sort -u)
    entries=$(printf '%s\n%s\n' reference "$changed" | grep . | sort -u)
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
