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

### Run analytics locally
1. Activate venv with `source .venv/bin/activate`
2. Install packages `python3 -m pip install -r requirements.txt`
3. Run Flask app in dev mode `doppler run -- flask run --debug`

### Run fpp-server locally
1. [Install Bun](https://bun.sh/docs/installation) if not already installed
2. Create a .env file in 'fpp-server' and paste the FPP_SERVER_SECRET into it from running `doppler secrets get FPP_SERVER_SECRET --plain` 
3. Run `bun run dev` in the `fpp-server` directory