/** k6 provides `console`; @types/k6 does not declare it and the scenario's tsconfig has no DOM. */
declare const console: {
  log(...data: unknown[]): void
  error(...data: unknown[]): void
}
