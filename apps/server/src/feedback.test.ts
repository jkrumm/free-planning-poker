import { describe, expect, test } from 'bun:test';

import { createFeedbackService } from './feedback';

const input = { title: ' Broken card ', version: 'abc1234', route: '/room' };

function service(overrides: Parameters<typeof createFeedbackService>[0]) {
  return createFeedbackService(overrides);
}

describe('feedback service', () => {
  test('is unavailable without door url and token', async () => {
    const result = await service({ url: undefined, token: 't' }).submit(
      input,
      'a',
    );
    expect(result.status).toBe(503);
  });

  test('forwards a trimmed body with the bearer token', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const svc = service({
      url: 'http://door/feedback/app',
      token: 'secret',
      fetch: (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
    });
    const result = await svc.submit({ ...input, text: '  ' }, 'a');
    expect(result.status).toBe(200);
    expect(seen?.url).toBe('http://door/feedback/app');
    expect((seen?.init.headers as Record<string, string>).authorization).toBe(
      'Bearer secret',
    );
    expect(JSON.parse(seen?.init.body as string)).toEqual({
      title: 'Broken card',
      version: 'abc1234',
      route: '/room',
    });
  });

  test('maps a door refusal and a network failure to 502', async () => {
    const refused = service({
      url: 'http://door',
      token: 't',
      fetch: (async () =>
        new Response('', { status: 401 })) as unknown as typeof fetch,
    });
    expect((await refused.submit(input, 'a')).status).toBe(502);

    const down = service({
      url: 'http://door',
      token: 't',
      fetch: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect((await down.submit(input, 'a')).status).toBe(502);
  });

  test('rate-limits per client and recovers after the window', async () => {
    let t = 0;
    const svc = service({
      url: 'http://door',
      token: 't',
      perClientLimit: 2,
      windowMs: 1000,
      now: () => t,
      fetch: (async () => new Response('{}')) as unknown as typeof fetch,
    });
    expect((await svc.submit(input, 'a')).status).toBe(200);
    expect((await svc.submit(input, 'a')).status).toBe(200);
    const limited = await svc.submit(input, 'a');
    expect(limited.status).toBe(429);
    expect((await svc.submit(input, 'b')).status).toBe(200);
    t = 1001;
    expect((await svc.submit(input, 'a')).status).toBe(200);
  });

  test('enforces the global cap across clients', async () => {
    const svc = service({
      url: 'http://door',
      token: 't',
      globalLimit: 2,
      fetch: (async () => new Response('{}')) as unknown as typeof fetch,
    });
    await svc.submit(input, 'a');
    await svc.submit(input, 'b');
    expect((await svc.submit(input, 'c')).status).toBe(429);
  });
});
