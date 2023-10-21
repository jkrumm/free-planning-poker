import { type Config } from "drizzle-kit";

import "dotenv/config";

export default {
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  driver: "turso",
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_TOKEN!,
  },
  strict: true,
  verbose: true,
  breakpoints: true,
} satisfies Config;
