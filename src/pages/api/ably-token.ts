import type { NextApiRequest, NextApiResponse } from "next";
import Ably from "ably/promises";
import { uuid } from "uuidv4";

const rest = new Ably.Rest(process.env.ABLY_API_KEY as string);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const tokenRequest = await rest.auth.createTokenRequest({ clientId: uuid() });
  res.status(200).json(tokenRequest);
}
