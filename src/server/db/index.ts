// export const db = drizzle(
//   new Client({
//     url: env.DATABASE_URL,
//   }).connection(),
//   { schema },
// );

// const connection = connect({
//   url: process.env.DATABASE_URL,
// });
//
// export const db = drizzle(connection, { schema });

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_TOKEN!,
});

const db = drizzle(client, { schema });

export default db;

//    "migrations:generate": "drizzle-kit generate:mysql",
//    "migrations:push": "node -r esbuild-register src/server/db/migrate.ts",

// "migrations:push": "drizzle-kit push:sqlite",
