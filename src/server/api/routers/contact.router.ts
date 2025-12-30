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
        name: z.string().max(50, { error: 'Name too long' }).optional(),
        email: z
          .string()
          .email({ error: 'Invalid email address' })
          .max(70, { error: 'Email too long' }),
        subject: z
          .string()
          .min(3, { error: 'Subject must be at least 3 characters' })
          .max(100, { error: 'Subject too long' }),
        message: z.string().max(800, { error: 'Message too long' }).optional(),
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

      const response = await fetch(`${env.BEA_BASE_URL}/fpp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.BEA_SECRET_KEY}`,
        },
        body: JSON.stringify({ name, email, subject, message }),
        signal: AbortSignal.timeout(7000),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to send contact form: ${response.status} ${response.statusText}`,
        });
      }
    }),
});
