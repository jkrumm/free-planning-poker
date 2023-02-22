import { uuid } from "uuidv4";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import Ably from "ably/promises";

const rest = new Ably.Rest(process.env.ABLY_API_KEY as string);

export const ablyRouter = createTRPCRouter({
  getToken: publicProcedure.query(() => {
    return rest.auth.createTokenRequest({
      clientId: uuid(),
    });
  }),
});
