import React from 'react';

import Script from 'next/script';

import { env } from 'fpp/env';

import {
  UMAMI_BEFORE_SEND_GLOBAL,
  buildUmamiScriptProps,
  umamiBeforeSend,
} from 'fpp/utils/umami';

// The tracker looks the hook up on `window` when it loads, so it has to exist
// before the script tag is inserted. Assigning at module load is earlier than
// any effect.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)[UMAMI_BEFORE_SEND_GLOBAL] =
    umamiBeforeSend;
}

export function UmamiScript() {
  const props = buildUmamiScriptProps({
    scriptUrl: env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
    websiteId: env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  });
  if (!props) return null;

  return <Script strategy="afterInteractive" defer {...props} />;
}
