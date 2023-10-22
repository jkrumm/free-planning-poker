import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "fpp/env.mjs";
import { featureFlags, FeatureFlagType } from "fpp/server/db/schema";
import { eq } from "drizzle-orm";
import { NotImplementedError } from "fpp/constants/error.constant";

export const contactRouter = createTRPCRouter({
  sendMail: publicProcedure
    .input(
      z.object({
        name: z.string().max(40).optional(),
        email: z.string().max(60).optional(),
        subject: z.string().min(3).max(100),
        message: z.string().max(800).optional(),
      }),
    )
    .mutation(async ({ ctx, input: { name, email, subject, message } }) => {
      const featureFlagEntry = await ctx.db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.name, FeatureFlagType.CONTACT_FORM))
        .get();
      if (!featureFlagEntry?.enabled) {
        throw new NotImplementedError(
          "CONTACT_FORM feature flag is not enabled",
        );
      }

      const mailData = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        from: `FreePlanningPoker ${env.SEND_EMAIL}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        to: env.TARGET_EMAIL,
        subject: `FFP - ${subject.slice(0, 15)}`,
        text: `FreePlanningPoker.com - ${name} - ${email} - ${subject} - ${message}`,
        html: `<h1>FreePlanningPoker.com</h1><br /><h2>Name</h2><p>${name}</p><br /><h2>Email</h2><p>${email}</p><br /><h2>Subject</h2><p>${subject}</p><br /><h2>Message</h2><p>${message}</p>`,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
      const transporter = nodemailer.createTransport({
        port: 465,
        host: "smtp.gmail.com",
        auth: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: env.SEND_EMAIL,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          pass: env.SEND_EMAIL_PASSWORD,
        },
        secure: true,
      }) as nodemailer.Transporter;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      transporter.sendMail(mailData, function (err, info) {
        if (err) {
          throw new Error("Error sending email");
        } else {
          console.log(info);
        }
      });
    }),
});
