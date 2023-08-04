import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";

export const voteRouter = createTRPCRouter({
  vote: publicProcedure
    .input(
      z.object({
        room: z.string().min(2).max(15),
        votes: z
          .array(z.number())
          .min(1)
          .refine(
            (values) =>
              values.every((value) => fibonacciSequence.includes(value)),
            {
              message: "Every vote must be a valid fibonacci number",
            }
          ),
        amountOfSpectators: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input: { room, votes, amountOfSpectators } }) => {
      await ctx.prisma.vote.create({
        data: {
          room,
          votes,
          avgVote: votes.reduce((a, b) => a + b, 0) / votes.length,
          maxVote: votes.reduce((a, b) => Math.max(a, b), 1),
          minVote: votes.reduce((a, b) => Math.min(a, b), 34),
          amountOfVotes: votes.length,
          amountOfSpectators,
        },
      });
    }),
});
