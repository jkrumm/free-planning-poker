# [Free-Planning-Poker.com](https://free-planning-poker.com/)

#### Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused.

Based on NextJs, tRPC, Drizzle and Mantine UI components.

Mostly using Websocket communication utilizing Ably as Websocket service and Turso for edge DB.

All "personal" data is stored only in the visitors local storage.

## See in action

![demo](https://raw.githubusercontent.com/jkrumm/planning-poker/master/public/recording.gif)

### Run locally

- Use any Node 18 version
- Copy the `.env.example` to `.env` and fill in your
  - Ably API key
  - MySQL connection string

```bash
npm ci
```

```bash
npm run postinstall
```

```bash
npm run dev
```
