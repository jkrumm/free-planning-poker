export function sendTrackEstimation({
  visitorId,
  estimation,
  room,
  spectator,
}: {
  visitorId: string | null;
  room: string;
  estimation: number | null;
  spectator: boolean;
}) {
  const body = JSON.stringify({
    visitorId,
    estimation,
    room,
    spectator,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      `${process.env.NEXT_PUBLIC_API_ROOT}api/track-estimation`,
      body
    );
  } else {
    fetch(`${process.env.NEXT_PUBLIC_API_ROOT}api/track-estimation`, {
      body,
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // TODO: sentry
      return;
    });
  }
}
