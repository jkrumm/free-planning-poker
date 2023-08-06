import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { DateTime } from "luxon";

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
  getVotes: publicProcedure.query<Votes>(async ({ ctx }) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const totalVotes = (await ctx.prisma
      .$queryRaw`SELECT DATE(votedAt) AS date, COUNT(*) AS count
        FROM Vote
        GROUP BY date
        ORDER BY date DESC;`) as {
      date: Date;
      count: string;
    }[];

    return {
      totalVotes: totalVotes.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
    };
  }),
});

export interface Votes {
  totalVotes: { date: string; count: number }[];
}
