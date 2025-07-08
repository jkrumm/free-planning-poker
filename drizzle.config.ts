import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

// Parse DATABASE_URL
const databaseUrl = process.env.DATABASE_URL!;
const url = new URL(databaseUrl);

export default {
  schema: "./src/server/db/schema.ts",
  out: './drizzle',
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl,
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 3306,
    user: url.username,
    password: url.password,
    database: 'free-planning-poker'
  },
  strict: true,
  verbose: true,
  breakpoints: true,
} satisfies Config;