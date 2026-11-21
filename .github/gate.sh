#!/usr/bin/env bash
# CI's `ci` job, the one required check of master. NEEDS is `toJSON(needs)` of that job. It is red when a needed job
# failed or was cancelled, when `lanes` or `check` did not succeed, and when a job was skipped although `lanes` did
# not succeed: a lane job may be skipped only because `lanes` said its lane was not touched. A job added to `needs`
# is covered without a change here.
set -euo pipefail

needs=${NEEDS:?NEEDS is toJSON(needs) of the ci job}
failed=0

result() { jq -r --arg job "$1" '.[$job].result // "missing"' <<<"$needs"; }

for job in lanes check; do
    if [ "$(result "$job")" != success ]; then
        echo "ci: $job is '$(result "$job")', not success"
        failed=1
    fi
done

lanes_ok=$([ "$(result lanes)" = success ] && echo true || echo false)
while IFS=$'\t' read -r job outcome; do
    case "$outcome" in
        success) echo "ci: $job passed" ;;
        skipped)
            if [ "$lanes_ok" = true ]; then
                echo "ci: $job skipped, its lane was not touched"
            else
                echo "ci: $job skipped while lanes did not succeed"
                failed=1
            fi
            ;;
        *)
            echo "ci: $job is '$outcome'"
            failed=1
            ;;
    esac
done < <(jq -r 'to_entries[] | [.key, .value.result] | @tsv' <<<"$needs")

if [ "$failed" -ne 0 ]; then
    echo "ci: red"
    exit 1
fi
echo "ci: green"
