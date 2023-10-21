// import { migrate } from "drizzle-orm/planetscale-serverless/migrator";
// import { connect } from "@planetscale/database";
// import { drizzle } from "drizzle-orm/planetscale-serverless";
//
// import { fetch } from "undici";
//
// import "dotenv/config";
//
// // inspired by Raphael Moreau @rphlmr for Postgres, extended for Planetscale
// const runMigrate = async () => {
//   if (!process.env.DATABASE_URL) {
//     throw new Error("DATABASE_URL is not defined");
//   }
//
//   const connection = connect({
//     url: process.env.DATABASE_URL,
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//     fetch,
//   });
//
//   const db = drizzle(connection);
//
//   console.log("⏳ Running migrations...");
//
//   const start = Date.now();
//
//   await migrate(db, { migrationsFolder: "src/server/db/migrations" });
//
//   const end = Date.now();
//
//   console.log(`✅ Migrations completed in ${end - start}ms`);
//
//   process.exit(0);
// };
//
// runMigrate().catch((err) => {
//   console.error("❌ Migration failed");
//   console.error(err);
//   process.exit(1);
// });
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
// import * as process from "process";
import "dotenv/config";

async function main() {
  const db = drizzle(
    createClient({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_TOKEN!,
    }),
  );

  console.log("Running migrations");

  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });

  console.log("Migrated successfully");

  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed");
  console.error(e);
  process.exit(1);
});
