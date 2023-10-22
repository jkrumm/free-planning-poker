import { NextResponse } from "next/server";
import { withLogger } from "fpp/utils/api-logger.util";
import { type AxiomRequest } from "next-axiom";
import { logEndpoint } from "fpp/constants/logging.constant";
import { MethodNotAllowedError } from "fpp/constants/error.constant";
import db from "fpp/server/db";
import { featureFlags, FeatureFlagType } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";

export const config = {
  runtime: "edge",
};

const GetFeatureFlags = withLogger(async (req: AxiomRequest) => {
  req.log.with({ endpoint: logEndpoint.GET_FEATURE_FLAGS });

  if (req.method !== "GET") {
    throw new MethodNotAllowedError(
      "GET_FEATURE_FLAGS only accepts GET requests",
    );
  }

  const activeFeatureFlags = (
    await db
      .select({ name: featureFlags.name })
      .from(featureFlags)
      .where(sql`${featureFlags.enabled} = 1`)
      .all()
  ).map((row) => row.name);

  const allFeatureFlags = Object.keys(FeatureFlagType).map((name) => ({
    name,
    enabled: activeFeatureFlags.includes(name),
  }));

  return NextResponse.json(allFeatureFlags, { status: 200 });
});

export default GetFeatureFlags;
