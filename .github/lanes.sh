#!/usr/bin/env bash
# Which path-selected lanes this run executes: one `<lane>=true|false` line per lane of .github/lanes, written to
# $GITHUB_OUTPUT (stdout when unset). The pattern is weatherorb's .github/lanes.sh.
#
# The change is read from what was checked out, never from the event's base sha, which goes stale:
# - pull_request: the merge commit at depth 2, so `HEAD^1..HEAD` is exactly the pull request's change;
# - push: `BEFORE..HEAD` (the previous master tip, fetched if the shallow clone lacks it);
# - local (`make lanes`): the merge base with origin/master against the working tree;
# - anything else: every lane.
# A change to a path of the `every` line runs every lane, and so does a base that cannot be read.
set -euo pipefail

dir=$(cd "$(dirname "$0")" && pwd)
out=${GITHUB_OUTPUT:-/dev/stdout}
event=${EVENT:?EVENT is the github.event_name, or local}

lanes() { sed -n 's/^\([a-z][a-z-]*\):.*/\1/p' "$dir/lanes" | grep -vx every; }
inputs() { sed -n "s/^$1:[[:space:]]*//p" "$dir/lanes"; }

every_lane() {
    echo "lanes: every lane runs ($1)" >&2
    for lane in $(lanes); do echo "$lane=true" >>"$out"; done
    exit 0
}

head=HEAD
case "$event" in
    pull_request)
        base=$(git rev-parse --verify --quiet 'HEAD^1') || every_lane "the merge commit has no first parent in the clone"
        ;;
    push)
        base=${BEFORE:-}
        if [ -z "$base" ] || [ -z "${base//0/}" ]; then every_lane "a push with no previous tip"; fi
        git cat-file -e "$base^{commit}" 2>/dev/null || git fetch --quiet --no-tags --depth=1 origin "$base" ||
            every_lane "the previous tip $base cannot be fetched"
        ;;
    local)
        base=$(git merge-base origin/master HEAD) || every_lane "no merge base with origin/master"
        head=
        ;;
    *) every_lane "a $event run" ;;
esac

diff_args=("$base")
[ -n "$head" ] && diff_args+=("$head")
echo "lanes: $(git diff --name-only "${diff_args[@]}" | grep -c . || true) path(s) changed against ${base:0:12}" >&2

# shellcheck disable=SC2046 # the pathspecs are word-split on purpose
if ! git diff --quiet "${diff_args[@]}" -- $(inputs every); then every_lane "a change to a path of the every line"; fi

for lane in $(lanes); do
    # shellcheck disable=SC2046
    if git diff --quiet "${diff_args[@]}" -- $(inputs "$lane"); then
        echo "$lane=false" >>"$out"
        echo "lanes: $lane skipped" >&2
    else
        echo "$lane=true" >>"$out"
        echo "lanes: $lane runs" >&2
    fi
done
