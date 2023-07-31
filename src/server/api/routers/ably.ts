import shortUUID from "short-uuid";
import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import Ably from "ably/promises";

const rest = new Ably.Rest(process.env.ABLY_API_KEY!);

export const ablyRouter = createTRPCRouter({
  getToken: publicProcedure.query(() => {
    return rest.auth.createTokenRequest({
      clientId: shortUUID.generate(),
    });
  }),
});
