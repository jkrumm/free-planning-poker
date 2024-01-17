import { type NextRequest, NextResponse } from 'next/server';

import { env } from 'fpp/env.mjs';

import { type AxiomRequest, type Logger } from 'next-axiom';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';
import { logEndpoint } from 'fpp/constants/logging.constant';

import { withLogger } from 'fpp/utils/api-logger.util';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // no caching

const AblyToken = withLogger(async (request: AxiomRequest) => {
  const req = request as NextRequest & { log: Logger };
  req.log.with({ endpoint: logEndpoint.ABLY_TOKEN });

  if (req.method !== 'GET') {
    throw new MethodNotAllowedError('ABLY_TOKEN only accepts GET requests');
  }

  const clientId = req.nextUrl.searchParams.get('clientId');

  if (!clientId || !/^[A-Za-z0-9_~]{21}$/.test(clientId)) {
    throw new BadRequestError('clientId invalid');
  }

  try {
    const key = env.ABLY_API_KEY.split(':'),
      keyName: string = key[0]!,
      keySecret: string = key[1]!;

    const body = {
      keyName: keyName,
      ttl: 60 * 60 * 1000,
      capability: '{"room:*":["subscribe"]}',
      clientId,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    };

    const signText =
      body.keyName +
      '\n' +
      body.ttl +
      '\n' +
      body.capability +
      '\n' +
      clientId +
      '\n' +
      body.timestamp +
      '\n' +
      body.nonce +
      '\n';

    const mac = await hmacSign(signText, keySecret);

    const tokenRequestReq = await fetch(
      `https://rest.ably.io/keys/${keyName}/requestToken`,
      {
        body: JSON.stringify({
          ...body,
          mac,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );

    const tokenRequest = (await tokenRequestReq.json()) as { token: string };

    return NextResponse.json(tokenRequest.token);
  } catch (e) {
    throw e;
  }
});

async function hmacSign(signText: string, keySecret: string) {
  const signTextEncoded = new TextEncoder().encode(signText);
  const keySecretEncoded = new TextEncoder().encode(keySecret);

  const key = await crypto.subtle.importKey(
    'raw',
    keySecretEncoded,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, signTextEncoded);

  // convert ArrayBuffer to Array
  const array = Array.from(new Uint8Array(signature));

  // Convert the Array into base64 string
  return btoa(String.fromCharCode.apply(null, array));
}

export default AblyToken;
