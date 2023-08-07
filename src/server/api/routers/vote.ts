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
          minVote: votes.reduce((a, b) => Math.min(a, b), 21),
          amountOfVotes: votes.length,
          amountOfSpectators,
        },
      });
    }),
  getVotes: publicProcedure.query<Votes>(async ({ ctx }) => {
    const averages = await ctx.prisma.$queryRaw<
      {
        avg_avgVote: string;
        avg_maxVote: string;
        avg_minVote: string;
        avg_amountOfVotes: string;
        avg_amountOfSpectators: string;
      }[]
    >`SELECT AVG(avgVote)            as avg_avgVote,
        AVG(maxVote)            as avg_maxVote,
        AVG(minVote)            as avg_minVote,
        AVG(amountOfVotes)      as avg_amountOfVotes,
        AVG(amountOfSpectators) as avg_amountOfSpectators
    FROM Vote`;

    const oldestVote =
      (
        await ctx.prisma.vote.findFirst({
          orderBy: {
            votedAt: "asc",
          },
        })
      )?.votedAt ?? new Date();
    const totalVotes = await ctx.prisma.vote.count();
    const votesPerDay =
      Math.ceil(
        (totalVotes /
          DateTime.now().diff(DateTime.fromJSDate(oldestVote), "days").days) *
          100
      ) / 100;

    /* const votesPerVisitor =
      (
        await ctx.prisma.$queryRaw<
          {
            votesPerVisitor: number;
          }[]
        >`
     SELECT
    (SELECT COUNT(*) FROM Event WHERE type = 'VOTED') /
    (SELECT COUNT(DISTINCT visitorId) FROM Event WHERE type = 'VOTED')
    AS votesPerVisitor`
      )[0]?.votesPerVisitor ?? 0; */

    return {
      totalVotes: await ctx.prisma.event.count({
        where: {
          type: "VOTED",
        },
      }),
      votesPerDay,
      votesPerVisitor: 0,
      amountOfVotes:
        Math.ceil(parseInt(averages[0]?.avg_amountOfVotes ?? "0") * 100) / 100,
      amountOfSpectators:
        Math.ceil(parseInt(averages[0]?.avg_amountOfSpectators ?? "0") * 100) /
        100,
      highestVoteAvg:
        Math.ceil(parseInt(averages[0]?.avg_maxVote ?? "0") * 100) / 100,
      lowestVoteAvg:
        Math.ceil(parseInt(averages[0]?.avg_minVote ?? "0") * 100) / 100,
      voteAvg: Math.ceil(parseInt(averages[0]?.avg_avgVote ?? "0") * 100) / 100,
    };
  }),
});

export interface Votes {
  totalVotes: number;
  votesPerDay: number;
  votesPerVisitor: number;
  amountOfVotes: number;
  amountOfSpectators: number;
  highestVoteAvg: number;
  lowestVoteAvg: number;
  voteAvg: number;
}
