#!/usr/bin/env node
// Post-build source-map upload for HyperDX. Fail-soft: missing env vars or a
// non-zero upload exit shouldn't break the Vercel build — stack traces just
// stay un-symbolicated until the next deploy with valid credentials.
import { spawnSync } from 'node:child_process';

const serviceKey = process.env.HYPERDX_SERVICE_KEY;
const apiUrl = process.env.HYPERDX_API_URL ?? 'https://hyperdx.jkrumm.com';
const releaseId = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';

if (!serviceKey) {
  console.log(
    '[hyperdx] HYPERDX_SERVICE_KEY not set — skipping source-map upload.',
  );
  process.exit(0);
}

const args = [
  '@hyperdx/cli',
  'upload-sourcemaps',
  '--serviceKey',
  serviceKey,
  '--apiUrl',
  apiUrl,
  '--path',
  '.next',
  '--releaseId',
  releaseId,
];

console.log(
  `[hyperdx] uploading source maps from .next/ (release: ${releaseId})`,
);

// Hard 90s cap so a stalled npx/network call doesn't block the Vercel build.
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  timeout: 90_000,
  killSignal: 'SIGTERM',
});

if (result.error && result.error.code === 'ETIMEDOUT') {
  console.warn('[hyperdx] upload timed out after 90s — continuing (non-fatal).');
} else if (result.status !== 0) {
  console.warn(
    `[hyperdx] upload exited with status ${result.status} — continuing (non-fatal).`,
  );
}

process.exit(0);
