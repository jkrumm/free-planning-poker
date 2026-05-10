import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from repo root (env is typically provided by Doppler at runtime)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL!;
const url = new URL(databaseUrl);

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: databaseUrl,
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 3306,
    user: url.username,
    password: url.password,
    database: 'free-planning-poker',
  },
  strict: true,
  verbose: true,
  breakpoints: true,
} satisfies Config;
