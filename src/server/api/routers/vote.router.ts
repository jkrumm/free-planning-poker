import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { DateTime } from "luxon";
import { votes } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";
import { round } from "fpp/utils/number.utils";
import { countTable } from "fpp/utils/db-api.util";

export const voteRouter = createTRPCRouter({
  getVotes: publicProcedure.query(async ({ ctx: { db } }) => {
    const averages = (await db.execute(sql`
        SELECT AVG(avg_estimation)  as avg_avgEstimation,
          AVG(max_estimation)       as avg_maxEstimation,
          AVG(min_estimation)       as avg_minEstimation,
          AVG(amount_of_estimations) as avg_amountOfEstimations,
          AVG(amount_of_spectators) as avg_amountOfSpectators
        FROM fpp_votes`)) as unknown as {
      avg_avgEstimation: string;
      avg_maxEstimation: string;
      avg_minEstimation: string;
      avg_amountOfEstimations: string;
      avg_amountOfSpectators: string;
    };

    const oldestVote =
      (
        await db
          .select({
            votedAt: votes.votedAt,
          })
          .from(votes)
          .orderBy(votes.votedAt)
          .limit(1)
      )[0]?.votedAt.getUTCMilliseconds() ?? Date.now();

    const totalVotes = await countTable(votes);

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
