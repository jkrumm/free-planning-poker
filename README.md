# [Free-Planning-Poker.com](https://free-planning-poker.com/)

#### Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused.

Based on NextJs, tRPC, Drizzle and Mantine UI components.

Mostly using Websocket communication utilizing Ably as Websocket service 
and self-hosted MariaDB using my [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack).

All "personal" data is stored only in the visitors local storage.

## See in action

![demo](https://raw.githubusercontent.com/jkrumm/planning-poker/master/public/recording.gif)

### Run locally

1. Install any Node 20 version (exact 20.11.1) and Docker and Docker Compose and Doppler CLI
2. Clone [sideproject-docker-stack](https://github.com/jkrumm/sideproject-docker-stack)
3. Request access to the Doppler Dev projects `sideproject-docker-stack` and `free-planning-poker`
4. Run `sideproject-docker-stack` by following the instructions in the README
5. Set up the `free-planning-poker` Doppler project by running `doppler setup`
6. Install dependencies with `npm ci`
7. Run `doppler run -- npm run dev`

### Database Migrations

The project uses Drizzle Kit for database migrations. Available commands:

- `npm run db:generate` - Generate migration files from schema changes
- `npm run db:migrate` - Apply pending migrations to database
- `npm run db:studio` - Open Drizzle Studio database GUI
- `npm run db:check` - Check if schema and database are in sync

⚠️ **Important**: Before running any migration commands, verify that your `.env` file contains the correct `DATABASE_URL` - ensure it points to your local development database, not production!

**Migration workflow:**
1. Make changes to `src/server/db/schema.ts`
2. Run `npm run db:generate` to create migration files
3. Review the generated SQL in `drizzle/` folder
4. Switch the `.env` URL to use local database
5. Run `npm run db:migrate` to apply changes to local database
6. Validate locally if nothing breaks (functionality and data)
7. Switch the `.env` URL to use prod database
8. Run `npm run db:migrate` to apply changes to prod database

### Run fpp-server locally
1. [Install Bun](https://bun.sh/docs/installation) if not already installed
2. Create a .env file in 'fpp-server' and paste the FPP_SERVER_SECRET into it from running `doppler secrets get FPP_SERVER_SECRET --plain` 
3. Run `bun run dev` in the `fpp-server` directory

### Run fpp-analytics locally
1. Install mysql `brew install mysql`
2. Activate venv `source .venv/bin/activate`
3. Install requirements `python3 -m pip install -r requirements.txt`
5. Copy the .env.example to .env and add the FPP_DB_PW secret
6. Run the app: `flask run --debug -p 5100`