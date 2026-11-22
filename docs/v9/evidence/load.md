# load: 5,000 sockets in 500 rooms, and a handoff under load

Row `v9-load`, 2026-11-22. The scale target of `docs/v9/ARCHITECTURE.md` (Server, Scale target: one process, 500 rooms, 5,000 sockets, p99 from command to fan-out under 100 ms) and the claim that a deploy loses no acknowledged vote, measured. Method: `research/r09-testing-ci.md` section 6 and `research/r10-deploy-topology.md` section 6. How to rerun: `load/AGENTS.md`.

**Result: every threshold is met in both runs.** 5,000 sockets held, 15,000 acknowledged votes each found in the reveal that followed, no failed operation, p99 fan-out 4 ms outside the handoff. During the 20 s of the handoff the latency is seconds, which the row excepts; the number is recorded below.

## What was measured

| | |
|-|-|
| Commit | `02f8337` (the API and the room app of `f18e09f`, plus the load test) |
| Host | the Mac mini's Colima VM: 4 CPUs, 2.5 GiB, on Docker 29.9. The load generator, the proxy, the API and PostgreSQL share it, and other leads' containers were idle in the VM during both runs |
| Stack | `deploy/compose.yml` (API with the room app, PostgreSQL 18) behind an HAProxy 3.0 that routes by `/api/health`; the new API container exists before the handoff and receives nothing until the old one reports 503 |
| Scenario | 500 rooms of 10 seats, created over 30 s. Each room plays three rounds: every seat votes within 5 s, one seat reveals, one revotes. 1 % of seats lose their socket per minute and resume with their seat token. 170 s in all (`load/k6/profile.ts`, profile `full`) |
| Generator | k6 2.4.0 in a container with three of the VM's four CPUs; its quota throttled it in 0 of 1,705 periods |
| Samples | CPU and memory from `docker stats` about every 2 s, so a peak shorter than that is not seen |

A command's latency runs from the moment a seat sends it to the moment the last of the room's ten seats has the event, on its socket or in the welcome that replaced it. An error is a join, a resume, a command or a delivery that did not complete. A vote counts as missing when a reveal does not carry the card its ack promised.

## Run 1: steady, 2026-11-22 20:38 UTC

`make load`

| Threshold | Result |
|-|-|
| p99 fan-out under 100 ms | met: 4 ms |
| no acknowledged vote missing at a reveal | met: 15,000 of 15,000 present |
| error rate under 0.1 % | met: 0 of 41,118 operations |

| Fan-out (ms) | Samples | p50 | p95 | p99 | Max |
|-|-|-|-|-|-|
| all commands | 17,500 | 1 | 2 | 4 | 1,348 |

- Peak sockets: 4,999 open when the first round started (one seat was still joining).
- Reconnects: 118 seats resumed, in 826 ms at the median and 1,981 ms at most (the client's first wait is a uniform 0 to 2 s). The 1.3 s maximum above fits a seat that resumed while a command was in flight.
- Peak upgrades per second: 238, during the joins.

| Container | CPU peak, % of one core | CPU mean | Memory peak MiB |
|-|-|-|-|
| api | 30 | 10 | 125 |
| postgres | 25 | 6 | 110 |
| proxy | 17 | 5 | 88 |
| k6 | 58 | 17 | 674 |

## Run 2: the API container replaced halfway, 2026-11-22 20:42 UTC

`make load HANDOFF=1`. At 95 s, while round 2's votes are coming in, the old container gets SIGTERM; it drained and exited 0 after 427 ms, closing its sockets. The window of the handoff is the 20 s from that moment.

| Threshold | Result |
|-|-|
| p99 fan-out under 100 ms, outside the handoff window | met: 4 ms |
| no acknowledged vote missing at a reveal | met: 15,000 of 15,000 present, those of round 2 among them, which was running when the old container stopped |
| error rate under 0.1 % | met: 0 of 46,131 operations |

| Fan-out (ms) | Samples | p50 | p95 | p99 | Max |
|-|-|-|-|-|-|
| outside the handoff window | 12,917 | 1 | 2 | 4 | 960 |
| the handoff's 20 s | 4,583 | 730 | 4,891 | 5,322 | 5,592 |

- Peak sockets: 4,998 open when the first round started; 5,131 sockets resumed after the handoff (the whole table and the churn).
- **Reconnect storm: 2,644 upgrades per second at its peak**, 440 of them ended before a welcome (the proxy log shows moments with no healthy server during the switch) and were retried. A seat was without a socket for 4.4 s at the median, 5.5 s at the 99th percentile and 5.6 s at most: the proxy takes two failed health checks (about 2 s) to move on, and the client waits a uniform 0 to 2 s first.
- After the run all 500 rooms in `fpp.room_snapshot` belong to one owner, the new process, at epoch 2: none is owned by two processes.
- No gap in any seat's `seq` (0 gaps), no container killed.

| Container | CPU peak, % of one core | CPU mean | Memory peak MiB |
|-|-|-|-|
| api (old, until its stop) | 49 | 12 | 117 |
| api-next | 103 | 5 | 171 |
| postgres | 47 | 6 | 91 |
| proxy | 46 | 5 | 188 |
| k6 | 170 | 18 | 764 |

The new API's one core was full for the storm. The latency it caused is inside the 20 s window.

## How to read these numbers

- **They are not the VPS's.** The generator and the server compete for four CPUs in a VM, and every byte crosses the VM's network twice. A number on the VPS needs its own run; this one shows that the target is met on a smaller machine, with the API using at most a third of a core in steady state.
- **The generator's quota decides what it measures.** With two CPUs, k6 was throttled and the same server reported a p99 of 598 ms; with three the quota never engaged and p99 was 4 to 6 ms. The report prints the throttling; a run that shows any is not evidence of the server.
- **Two harness faults were found and fixed on the way**, both of the generator's side: a delivery was not counted for a seat whose welcome arrived before the first event of a command was seen (47 to 59 false errors in the handoff run), and the first proxy, Caddy, stopped after reaching 110 MiB of its 128 MiB limit as the sockets arrived, and the run went with it. HAProxy replaced it. A third run was lost when k6 exited with 137 while another job's build held most of the VM's memory; it was rerun when the VM was quiet.
- The handoff's latency is the client's waiting more than the server's work: a seat does not reconnect before its first wait, and the proxy does not route to the new container before two health checks fail. Both belong to the topology (`research/r10-deploy-topology.md`, section 6), not to this row to tune.

## Found, not fixed

- The API answers 500 to a request with no `Host` header (HTTP/1.0 health checks), `issue_3056`. The proxy's check sends HTTP/1.1 with a `Host`.
- The image's `/app/drizzle/meta` loses its execute bit when the image is built with `docker compose build` on a GitHub-hosted runner, so the API cannot read its migrations there, `issue_3059`. The nightly builds the image with `docker/build-push-action`, as CI's image job does.

## The nightly guard

`nightly.yml` job `load`: 50 rooms on a hosted `ubuntu-24.04` runner, steady and with a handoff, the same thresholds, the results kept as an artifact for 14 days. It passed once by dispatch on the branch of this row: run 45067153181, both profiles, no failed operation, p99 2.1 ms outside the handoff. It guards against regressions, not capacity.
