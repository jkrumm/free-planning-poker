/**
 * A DOM for one test file. It registers when it is first imported, and a test file imports it before anything that
 * imports React: react-dom decides what the page supports (`input` events among them) at the moment it loads, so a
 * DOM that arrives later is a DOM it never sees. The file unregisters in `afterAll`, so other tests keep Bun's own
 * `fetch`, `WebSocket` and timers.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

export function registerDom(): void {
  if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ url: 'http://test.local/' })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
}

export const unregisterDom = (): Promise<void> => GlobalRegistrator.unregister()

registerDom()
