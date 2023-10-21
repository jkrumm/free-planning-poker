import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { fibonacciSequence } from "fpp/constants/fibonacci.constant";
import { DateTime } from "luxon";
import { votes } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";
import { round } from "fpp/utils/number.utils";
import { countTable } from "fpp/utils/db-api.util";

export const voteRouter = createTRPCRouter({
  vote: publicProcedure
    .input(
      z.object({
        room: z.string().min(2).max(15),
        estimations: z
          .array(z.number())
          .min(1)
          .refine(
            (values) =>
              values.every((value) => fibonacciSequence.includes(value)),
            {
              message: "Every vote must be a valid fibonacci number",
            },
          ),
        duration: z.number().min(0),
        amountOfSpectators: z.number().min(0),
      }),
    )
    .mutation(
      async ({
        ctx: { db },
        input: { room, estimations, duration, amountOfSpectators },
      }) => {
        await db.insert(votes).values({
          room,
          avgEstimation:
            estimations.reduce((a, b) => a + b, 0) / estimations.length,
          maxEstimation: estimations.reduce((a, b) => Math.max(a, b), 1),
          minEstimation: estimations.reduce((a, b) => Math.min(a, b), 21),
          finalEstimation: null,
          amountOfEstimations: estimations.length,
          amountOfSpectators,
          duration,
        });
      },
    ),
  getVotes: publicProcedure.query(async ({ ctx: { db } }) => {
    // if (env.NEXT_PUBLIC_NODE_ENV === "development") {
    //   return sampleVotes;
    // }

    const averages = await db.get<{
      avg_avgEstimation: string;
      avg_maxEstimation: string;
      avg_minEstimation: string;
      avg_finalEstimation: string;
      avg_amountOfEstimations: string;
      avg_amountOfSpectators: string;
    }>(sql`
        SELECT AVG(avg_estimation)  as avg_avgEstimation,
          AVG(max_estimation)       as avg_maxEstimation,
          AVG(min_estimation)       as avg_minEstimation,
          AVG(final_estimation)     as avg_finalEstimation,
          AVG(amount_of_estimation) as avg_amountOfEstimations,
          AVG(amount_of_spectators) as avg_amountOfSpectators
        FROM fpp_votes`);

    const oldestVote =
      (
        await db
          .select({
            votedAt: votes.votedAt,
          })
          .from(votes)
          .orderBy(votes.votedAt)
          .limit(1)
      )[0]?.votedAt ?? Date.now();

    const totalVotes = await countTable(db, votes);

    const votesPerDay =
      Math.ceil(
        (totalVotes /
          DateTime.now().diff(DateTime.fromMillis(oldestVote), "days").days) *
          100,
      ) / 100;

    return {
      totalVotes,
      votesPerDay,
      votesPerVisitor: 0,
      totalEstimations: 0,
      estimationsPerDay: 0,
      avgAmountOfEstimations: round(averages.avg_amountOfEstimations),
      avgAmountOfSpectators: round(averages.avg_amountOfSpectators),
      avgMaxEstimation: round(averages.avg_maxEstimation),
      avgMinEstimation: round(averages.avg_minEstimation),
      avgAvgEstimation: round(averages.avg_avgEstimation),
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

// const sampleVotes: Votes = {
//   totalVotes: 100,
//   votesPerDay: 10,
//   votesPerVisitor: 3,
//   amountOfVotes: 3,
//   amountOfSpectators: 0.93,
//   highestVoteAvg: 8,
//   lowestVoteAvg: 3,
//   voteAvg: 5,
// };
