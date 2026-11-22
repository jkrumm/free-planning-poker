# load: 5,000 sockets in 500 rooms, and a handoff under load

Row `v9-load`, 2026-11-22. The scale target of `docs/v9/ARCHITECTURE.md` (Server, Scale target: one process, 500 rooms, 5,000 sockets, p99 from command to fan-out under 100 ms) and the claim that a deploy loses no acknowledged vote, measured. Method: `research/r09-testing-ci.md` section 6 and `research/r10-deploy-topology.md` section 6. How to rerun: `load/AGENTS.md`.

**Result: every threshold is met in both runs.** 5,000 sockets held, 15,000 acknowledged votes each found in the reveal that followed, no failed operation, p99 fan-out 4 ms outside the handoff. During the 20 s of the handoff the latency is seconds, which the row excepts; the number is recorded below.

## What was measured

| | |
|-|-|
| Commit | master at `cb348f8` with this row on top (the row's files are those of `1d9555b`, the head of its pull request before it landed). The API and the room app are unchanged by the row |
| Host | the Mac mini's Colima VM: 4 CPUs, 2.5 GiB, on Docker 29.9. The load generator, the proxy, the API and PostgreSQL share it, and other leads' containers were idle in the VM during both runs |
| Stack | `deploy/compose.yml` (API with the room app, PostgreSQL 18) behind an HAProxy 3.0 that routes by `/api/health`; the new API container exists before the handoff and receives nothing until the old one reports 503 |
| Scenario | 500 rooms of 10 seats, created over 30 s. Each room plays three rounds: every seat votes within 5 s, one seat reveals, one revotes. 1 % of seats lose their socket per minute and resume with their seat token. 170 s in all (`load/k6/profile.ts`, profile `full`) |
| Generator | k6 2.4.0 in a container with three of the VM's four CPUs; its quota throttled it in 0 of 1,705 periods |
| Samples | CPU and memory from `docker stats` about every 2 s, so a peak shorter than that is not seen |

A command's latency runs from the moment a seat sends it to the moment the last of the room's ten seats has the event, on its socket or in the welcome that replaced it. An error is a join, a resume, a command or a delivery that did not complete. A vote counts as missing when a reveal does not carry the card its ack promised.

## Run 1: steady, 2026-11-22 20:50 UTC

`make load`

| Threshold | Result |
|-|-|
| p99 fan-out under 100 ms | met: 8 ms |
| no acknowledged vote missing at a reveal | met: 15,000 of 15,000 present |
| error rate under 0.1 % | met: 0 of 41,108 operations |

| Fan-out (ms) | Samples | p50 | p95 | p99 | Max |
|-|-|-|-|-|-|
| all commands | 17,500 | 1 | 2 | 8 | 1,891 |

- Peak sockets: 4,999 open when the first round started (one seat was still joining).
- Reconnects: 108 seats resumed, in 1,122 ms at the median and 1,994 ms at most (the client's first wait is a uniform 0 to 2 s). The 1.9 s maximum above fits a seat that resumed while a command was in flight.
- Peak upgrades per second: 270, during the joins.

| Container | CPU peak, % of one core | CPU mean | Memory peak MiB |
|-|-|-|-|
| api | 29 | 9 | 111 |
| postgres | 21 | 5 | 102 |
| proxy | 19 | 4 | 85 |
| k6 | 65 | 17 | 628 |

## Run 2: the API container replaced halfway, 2026-11-22 21:00 UTC

`make load HANDOFF=1`. At 95 s, while round 2's votes are coming in, the old container gets SIGTERM; it drained and exited 0 after 416 ms, closing its sockets. The window of the handoff is the 20 s from that moment.

| Threshold | Result |
|-|-|
| p99 fan-out under 100 ms, outside the handoff window | met: 4 ms |
| no acknowledged vote missing at a reveal | met: 15,000 of 15,000 present, those of round 2 among them, which was running when the old container stopped |
| error rate under 0.1 % | met: 0 of 46,097 operations |

| Fan-out (ms) | Samples | p50 | p95 | p99 | Max |
|-|-|-|-|-|-|
| outside the handoff window | 12,844 | 1 | 2 | 4 | 5,837 |
| the handoff's 20 s | 4,656 | 545 | 4,827 | 5,274 | 5,681 |

- Peak sockets: 5,000 open when the first round started; 5,097 sockets resumed after the handoff (the whole table and the churn).
- **Reconnect storm: 2,539 upgrades per second at its peak**, 6 of them ended before a welcome and were retried. A seat was without a socket for 4.3 s at the median, 5.4 s at the 99th percentile and 5.7 s at most: the proxy takes two failed health checks (about 2 s) to move on, and the client waits a uniform 0 to 2 s first.
- The 5.8 s maximum outside the window is one command counted by the second it was sent in: it left just before the stop and its last seat got it from the new container.
- After the run all 500 rooms in `fpp.room_snapshot` belong to one owner, the new process, at epoch 2: none is owned by two processes.
- No gap in any seat's `seq` (0 gaps), no container killed.

| Container | CPU peak, % of one core | CPU mean | Memory peak MiB |
|-|-|-|-|
| api (old, until its stop) | 33 | 12 | 122 |
| api-next | 93 | 5 | 147 |
| postgres | 38 | 6 | 107 |
| proxy | 50 | 5 | 192 |
| k6 | 173 | 21 | 773 |

The new API's core was nearly full for the storm. The latency it caused is inside the 20 s window.

## How to read these numbers

- **They are not the VPS's.** The generator and the server compete for four CPUs in a VM, and every byte crosses the VM's network twice. A number on the VPS needs its own run; this one shows that the target is met on a smaller machine, with the API using under a third of a core in steady state.
- **The generator's quota decides what it measures.** With two CPUs, k6 was throttled and the same server reported a p99 of 598 ms; with three the quota never engaged and p99 was 4 to 6 ms. The report prints the throttling; a run that shows any is not evidence of the server.
- **Another tenant of the VM can spoil a run.** A nightly build of another repository, running for twenty minutes or more, drove the VM's load average above 20 and its memory pressure to a third of the time; two handoff runs and one steady run were lost to it (health checks timing out, a seat without a socket for 130 s, k6 killed) and rerun when it had finished. `docker ps` before a run says whether it is there.
- **Two harness faults were found and fixed on the way**, both of the generator's side: a delivery was not counted for a seat whose welcome arrived before the first event of a command was seen (47 to 59 false errors in the handoff run), and the first proxy, Caddy, stopped after reaching 110 MiB of its 128 MiB limit as the sockets arrived, and the run went with it. HAProxy replaced it.
- The handoff's latency is the client's waiting more than the server's work: a seat does not reconnect before its first wait, and the proxy does not route to the new container before two health checks fail. Both belong to the topology (`research/r10-deploy-topology.md`, section 6), not to this row to tune.

## Found, not fixed

- The API answers 500 to a request with no `Host` header (HTTP/1.0 health checks), `issue_3056`. The proxy's check sends HTTP/1.1 with a `Host`.
- The same hole in the image that `make v9-image-perms` closed on master meanwhile: under the runner's built-in BuildKit `/app/drizzle/meta` lost its execute bit, so the API could not read its migrations. The nightly of this row hit it first and now builds with the fixed Dockerfile.

## The nightly guard

`nightly.yml` job `load`: 50 rooms on a hosted `ubuntu-24.04` runner, steady and with a handoff, the same thresholds, the results kept as an artifact for 14 days. It passed by dispatch on the branch of this row, twice, the second time on the final files: run 45069970342 at `1d9555b`, both profiles, no failed operation (0 of 4,107 and 0 of 4,604) and a p99 of 2 ms outside the handoff, 4.8 s inside it. It guards against regressions, not capacity.
