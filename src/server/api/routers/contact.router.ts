import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { toCustomTRPCError } from 'fpp/server/api/custom-error';
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
        .execute()
        .catch((error) => {
          throw toCustomTRPCError(error, 'Failed to query feature flag', {
            component: 'contactRouter',
            action: 'sendMail',
            extra: {
              featureFlag: FeatureFlagType.CONTACT_FORM,
            },
          });
        });

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
      }).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to send contact email', {
          component: 'contactRouter',
          action: 'sendMail',
          extra: {
            email,
            subject: subject.substring(0, 50),
            beaBaseUrl: env.BEA_BASE_URL,
          },
        });
      });

      if (!response.ok) {
        throw toCustomTRPCError(
          new Error(
            `Failed to send contact form: ${response.status} ${response.statusText}`,
          ),
          'Contact email API returned error status',
          {
            component: 'contactRouter',
            action: 'sendMail',
            extra: {
              email,
              subject: subject.substring(0, 50),
              status: response.status,
            },
          },
        );
      }
    }),
});
