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
6. Install dependencies with `npm ci` and `npm run postinstall`
7. Run `doppler run -- npm run dev`