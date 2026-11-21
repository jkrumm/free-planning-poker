# Free Planning Poker

Free Planning Poker is a free, open-source planning poker app for agile teams: open a room, share the link, estimate story points together. No account, no tracking cookies. Live at **https://free-planning-poker.com**.

## The code

`master` is v9, a rewrite in progress: a Bun workspace with an Elysia API and a pure TypeScript room core, and in later stages a Vite room app and an Astro site. The plan and its reasoning are in `docs/v9/`.

The version in production today is v1, frozen on the branch [`v1`](https://github.com/jkrumm/free-planning-poker/tree/v1) until the cutover.

```bash
bun install --frozen-lockfile
make check-fast   # format, lint, types, boundaries, unit tests
make check        # plus the server tests against Postgres and the build
```

`docs/development.md` describes the toolchain; `AGENTS.md` the rules every change follows.

## License

[AGPL-3.0](LICENSE)
