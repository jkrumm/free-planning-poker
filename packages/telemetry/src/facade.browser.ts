/**
 * The browser's facade for Umami: `track` calls `window.umami.track` when Umami's script is present and does
 * nothing otherwise, so the room and the site run the same code with and without it (no cookie, no banner:
 * invariant 10). The script itself arrives with `v9-umami-events`.
 */
import type { UmamiData, UmamiEvent } from './umami.ts'

type UmamiScript = { readonly track: (event: string, data?: Record<string, unknown>) => unknown }

export function track<E extends UmamiEvent>(event: E, data: UmamiData<E>): void {
  const script = (globalThis as { umami?: UmamiScript }).umami
  if (typeof script?.track !== 'function') return
  try {
    script.track(event, { ...data })
  } catch {
    // Measurement never breaks the product.
  }
}
