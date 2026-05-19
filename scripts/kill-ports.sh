#!/usr/bin/env bash
# Kill anything listening on the given TCP ports. Idempotent; safe if nothing
# is bound. Used by dev:all:* scripts to guarantee a clean local port before
# binding — replaces `npx kill-port` which paid an ~8s npm cold-install cost.
set -eu
for port in "$@"; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
