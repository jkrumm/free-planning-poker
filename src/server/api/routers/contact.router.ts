import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { FeatureFlagType, featureFlags } from 'fpp/server/db/schema';

export const contactRouter = createTRPCRouter({
  sendMail: publicProcedure
    .input(
      z.object({
        name: z.string().max(50).optional(),
        email: z.string().email().max(70),
        subject: z.string().min(3).max(100),
        message: z.string().max(800).optional(),
      }),
    )
    .mutation(async ({ ctx, input: { name, email, subject, message } }) => {
      const featureFlagEntry = await ctx.db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.name, FeatureFlagType.CONTACT_FORM))
        .execute();
      if (!featureFlagEntry[0]?.enabled) {
        throw new TRPCError({
          message: 'CONTACT_FORM feature flag is not enabled',
          code: 'NOT_IMPLEMENTED',
        });
      }

      await fetch(`${env.BEA_BASE_URL}:3010/fpp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.BEA_SECRET_KEY}`,
        },
        body: JSON.stringify({ name, email, subject, message }),
      }).then(async (res) => {
        if (res.status !== 200) {
          throw new TRPCError({
            message: 'Failed to send email',
            code: 'INTERNAL_SERVER_ERROR',
          });
        }
      });
    }),
});
