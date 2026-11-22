# Free Planning Poker

Free Planning Poker is a free, open-source planning poker app for agile teams: open a room, share the link, estimate story points together. No account, no tracking cookies. Live at **https://free-planning-poker.com**.

## A rewrite in progress

`master` is v9, a rewrite that has not shipped yet. The site you use today is v1, frozen on the branch [`v1`](https://github.com/jkrumm/free-planning-poker/tree/v1), and it stays in production until v9 replaces it in one cutover. Bug fixes to the live site go to `v1`; nothing on `master` deploys yet.

v9 is a Bun workspace: a pure TypeScript room core, an Elysia API with the WebSocket room server, and in later stages a Vite room app and an Astro site. It is built row by row from `docs/plan.yaml` by coding agents working from `AGENTS.md`. The concept, the architecture and the reasons behind each choice are in `docs/v9/`; `docs/README.md` lists every document.

## Run the checks

```bash
bun install --frozen-lockfile   # Bun version: packageManager in package.json
make check-fast                 # format, lint, types, boundaries, unit tests
make check                      # plus the server tests, each against its own PostgreSQL, and the build
```

The server tests need the PostgreSQL server binaries: `initdb` on PATH, or `PG_BIN_DIR` pointing at them. `docs/development.md` describes the toolchain, the test kit and CI.

## License

[AGPL-3.0](LICENSE)
