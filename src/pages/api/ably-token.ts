import type { NextApiRequest, NextApiResponse } from "next";
import Ably from "ably/promises";

const rest = new Ably.Rest(process.env.ABLY_API_KEY!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const clientId = req.query.clientId;
  if (!clientId) {
    res.status(403).end();
  } else {
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: String(clientId),
    });
    res.status(200).json(tokenRequest);
  }
}
