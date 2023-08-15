export function sendTrackEvent(event: string, visitorId: string | null) {
  const body = JSON.stringify({
    visitorId,
    event,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      `${process.env.NEXT_PUBLIC_API_ROOT}api/track-event`,
      body
    );
  } else {
    fetch(`${process.env.NEXT_PUBLIC_API_ROOT}api/track-event`, {
      body,
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // TODO: sentry
      return;
    });
  }
}
