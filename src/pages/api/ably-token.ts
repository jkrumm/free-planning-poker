import { NextResponse } from 'next/server';

import { env } from 'fpp/env';

import type { NextApiRequest } from '@trpc/server/adapters/next';

import {
  BadRequestError,
  MethodNotAllowedError,
} from 'fpp/constants/error.constant';

import { extractQueryParams } from 'fpp/utils/extract-query-params.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // no caching

const AblyToken = async (req: NextApiRequest) => {
  if (req.method !== 'GET' || req.url === undefined) {
    throw new MethodNotAllowedError('ABLY_TOKEN only accepts GET requests');
  }

  const { clientId } = extractQueryParams(req.url);

  if (!validateNanoId(clientId)) {
    throw new BadRequestError('userId invalid');
  }

  const key = env.ABLY_API_KEY.split(':');

  if (key.length !== 2 || !key[0] || !key[1]) {
    throw new Error('ABLY_API_KEY env var is invalid');
  }

  const keyName: string = key[0];
  const keySecret: string = key[1];

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

  return NextResponse.json(tokenRequest.token, { status: 200 });
};

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
