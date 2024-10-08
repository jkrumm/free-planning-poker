

## [6.1.0](https://github.com/jkrumm/free-planning-poker/compare/6.0.0...6.1.0) (2024-10-08)


### Features

* added 404 page ([7518790](https://github.com/jkrumm/free-planning-poker/commit/7518790bee65f96d35bb6242079ce4281fdef42b))
* updated Imprint to include own WebSocket server and Resend ([de0f6e8](https://github.com/jkrumm/free-planning-poker/commit/de0f6e867c9ce6d45d7a4f73e674159030048154))
* **v6:** added rejoin logic to keep user state shared ([fa89e5f](https://github.com/jkrumm/free-planning-poker/commit/fa89e5fa38adfff46d5ec5b3f9ed4927fcdd0ab4))
* **v6:** extended analytics with timestamps ([41ae314](https://github.com/jkrumm/free-planning-poker/commit/41ae31461f88879a068b3950148a8edd148b896d))
* **v6:** unified RoomState to reduce inconsistencies ([674a5ac](https://github.com/jkrumm/free-planning-poker/commit/674a5ac94dace486c65e4640099406678cb35206))


### Bug Fixes

* various Sentry errors ([c91725c](https://github.com/jkrumm/free-planning-poker/commit/c91725cddc787d925b3ce7fdc48b3fe307609d91))

## [6.0.0](https://github.com/jkrumm/free-planning-poker/compare/5.4.0...6.0.0) (2024-10-05)


### Features

* **v6:** new Bun fpp-server as WebSocket server ([ea766b1](https://github.com/jkrumm/free-planning-poker/commit/ea766b15bece6117bc16569a6fd18c9af6e745db))


### Other Changes

* use wss not ws on prod to access WebSocket ([0881db9](https://github.com/jkrumm/free-planning-poker/commit/0881db9f89af97a68eda75b3cf4d49e6f75e301c))

## [5.4.0](https://github.com/jkrumm/free-planning-poker/compare/5.3.0...5.4.0) (2024-09-08)


### Features

* **analytics:** added popularity of each weekday ([43b013d](https://github.com/jkrumm/free-planning-poker/commit/43b013d9af1c68dc4baa8f89d804cb2deca4b68b))
* **analytics:** added table view for historical data ([0c278f3](https://github.com/jkrumm/free-planning-poker/commit/0c278f319de921766afae73565c14bc75ff4b10f))


### Bug Fixes

* resolve key error in source group script ([f225f93](https://github.com/jkrumm/free-planning-poker/commit/f225f933b614f3ebd95f5a10c86021945e3796c9))


### Other Changes

* **analytics:** added github as source in analytics ([d7310f8](https://github.com/jkrumm/free-planning-poker/commit/d7310f8baecdba2eb8792012dc84b274e7b872da))
* **analytics:** extend sources with Teams and Bing ([a7f2ba7](https://github.com/jkrumm/free-planning-poker/commit/a7f2ba79aeda3f59e3840269dcc56d8ffe65fa10))
* **analytics:** filter page view duration and bounce rate to after 2024-05-23 ([151b93d](https://github.com/jkrumm/free-planning-poker/commit/151b93d238d8e17c9c78c45e5c2ee31fc64e5be1))
* **analytics:** simplified sources mapping algorithm ([b4f2ade](https://github.com/jkrumm/free-planning-poker/commit/b4f2ade8dddf4f850eb3c010818f872ca9b49083))
* responsive index Contact section ([7e6dd0a](https://github.com/jkrumm/free-planning-poker/commit/7e6dd0aa0fa045e2ba00901bf273ce447b9b6210))
* upgrade packages ([2b29e26](https://github.com/jkrumm/free-planning-poker/commit/2b29e26392440e353be9f0ee88b1686df45c71d4))

## [5.3.0](https://github.com/jkrumm/free-planning-poker/compare/5.2.0...5.3.0) (2024-06-02)


### Features

* **analytics:** add sources to analytics view ([db151c5](https://github.com/jkrumm/free-planning-poker/commit/db151c58848901ffdf0b3a02d99523a49bf908ad))
* **analytics:** add tooltip to historical chart ([0c47ab4](https://github.com/jkrumm/free-planning-poker/commit/0c47ab45de76ecda7a75448d71dc51f7082d1827))
* **analytics:** added estimation number popularity bar chart ([362d780](https://github.com/jkrumm/free-planning-poker/commit/362d780065eb49c08c757ef1ee858bd3369a1f9e))
* **analytics:** adjust default values and color of historical chart ([4332266](https://github.com/jkrumm/free-planning-poker/commit/433226651dcd7df5734ba9a02e46d1c892a881d2))

## [5.2.0](https://github.com/jkrumm/free-planning-poker/compare/5.1.0...5.2.0) (2024-06-01)


### Features

* **analytics:** add Dockerfile ([988cfae](https://github.com/jkrumm/free-planning-poker/commit/988cfae5e1946980fcc40da41391e31420d2d108))
* **analytics:** daily analytics email with Cron ([c60d227](https://github.com/jkrumm/free-planning-poker/commit/c60d2274ed02b03b45f577856bfe064082894b14))
* **analytics:** use env config for data dir ([16af339](https://github.com/jkrumm/free-planning-poker/commit/16af339ce6c49501a4e4c35d095ecffe86019a3a))


### Other Changes

* improve analytics cron error handling ([90bd371](https://github.com/jkrumm/free-planning-poker/commit/90bd371d50934b1d66e482ed9bf1f413c08605eb))
* improved google meta title and description ([39808bb](https://github.com/jkrumm/free-planning-poker/commit/39808bb287c06ab20aaa257d041115536332e9c3))
* update dependencies ([60617fd](https://github.com/jkrumm/free-planning-poker/commit/60617fd5a3f8f4b7c5d62c128859989b488899b3))

## [5.1.0](https://github.com/jkrumm/free-planning-poker/compare/5.0.0...5.1.0) (2024-05-21)


### Features

* **tracking:** extract source param from url in track page view ([d12fc46](https://github.com/jkrumm/free-planning-poker/commit/d12fc468d54c91ce4b1673c7789c707bee671c6d))


### Bug Fixes

* resolve hydration and suspense errors ([9c85ba6](https://github.com/jkrumm/free-planning-poker/commit/9c85ba6cfe105cdeb3112a08266fa2910bedb286))


### Other Changes

* adjusted roadmap subtasks icon to align to the top ([3a8e5e7](https://github.com/jkrumm/free-planning-poker/commit/3a8e5e74599beca6f0a303d1f3f071a855fe27d7))
* do not return successful message if analytics failed ([6823796](https://github.com/jkrumm/free-planning-poker/commit/68237967df23b8f2e23906ca721010e498d3d90d))

## [5.0.0](https://github.com/jkrumm/free-planning-poker/compare/4.0.0...5.0.0) (2024-05-19)


### Features

* **analytics:** added a description to the analytics page ([dc87382](https://github.com/jkrumm/free-planning-poker/commit/dc8738252de62992448527ac448cbc524805e3f2))
* **contact:** added description and invite to contribute ([bf04e4e](https://github.com/jkrumm/free-planning-poker/commit/bf04e4eda17b4b79a8a18e86066e1e570f5eb14a))
* **guide:** updated guide and added to landingpage ([cacb1ff](https://github.com/jkrumm/free-planning-poker/commit/cacb1ff5a0b4128db78ac562de02165c55e87d89))
* **navigation:** added main navigation ([0b64469](https://github.com/jkrumm/free-planning-poker/commit/0b64469b7386457c79a690e15fda5ec1c4eb29fb))
* **roadmap:** added description section ([8f4d311](https://github.com/jkrumm/free-planning-poker/commit/8f4d311826b423baedc1c3072113d636992e64d3))
* **roadmap:** added support for subtasks ([e9a04b5](https://github.com/jkrumm/free-planning-poker/commit/e9a04b52fd2a27231e04b08d186a4eee3acaf011))


### Other Changes

* disable dark reader ([9dba5fc](https://github.com/jkrumm/free-planning-poker/commit/9dba5fce22b5fc98d416b31fb698a34cfd5a3b23))
* made index privacy section responsive ([256bd8d](https://github.com/jkrumm/free-planning-poker/commit/256bd8dfebca431706cb729847379bb1c0e328ec))
* update dependencies ([331f702](https://github.com/jkrumm/free-planning-poker/commit/331f702a56842b6f786d63fa2ef218da2d43f195))

## [4.0.0](https://github.com/jkrumm/free-planning-poker/compare/3.2.0...4.0.0) (2024-05-16)


### Features

* **v4:** add features section ([c6c52ec](https://github.com/jkrumm/free-planning-poker/commit/c6c52ec8bd6aacc4c9effd27ec9bc2fd65d12fab))
* **v4:** add privacy section ([a77a056](https://github.com/jkrumm/free-planning-poker/commit/a77a0565f7a95e6e7ad7f6be1dffef44d86a6cf2))
* **v4:** moved guide to own page ([7dc49e7](https://github.com/jkrumm/free-planning-poker/commit/7dc49e7df441eff3b49332e9432b9cb7fc28b0e1))
* **v4:** updated main screenshot ([8403085](https://github.com/jkrumm/free-planning-poker/commit/840308545c8722416f5c77a4da3c499b5e8a392b))


### Other Changes

* adjust Sentry config to current and deprecated standard ([377073e](https://github.com/jkrumm/free-planning-poker/commit/377073eebad07f8f4a5d419276bb250523d96c6c))

## [3.2.0](https://github.com/jkrumm/free-planning-poker/compare/3.1.0...3.2.0) (2024-05-16)


### Features

* scrub user data in Sentry config and update imprint ([3592c44](https://github.com/jkrumm/free-planning-poker/commit/3592c44798b2d416a74f7702b82aec5c2f998075))


### Bug Fixes

* auto reconnect python db connection ([8e715ad](https://github.com/jkrumm/free-planning-poker/commit/8e715ad713a15a71a24f136f770e1e5b737c59bd))
* division by zero in analytics ([942d24e](https://github.com/jkrumm/free-planning-poker/commit/942d24efa04f67611ee1b50965e346ff64246650))


### Other Changes

* add og:site_name to meta ([bb59148](https://github.com/jkrumm/free-planning-poker/commit/bb59148a38f27357636cb6e37f8ad4b1e79a86aa))
* upgrade dependencies ([83cc217](https://github.com/jkrumm/free-planning-poker/commit/83cc217c938ac7555487d85b9144a456c787233d))

## [3.1.0](https://github.com/jkrumm/free-planning-poker/compare/3.0.2...3.1.0) (2024-05-07)


### Features

* **contact:** enabled email sending using bun-email-api service ([0208874](https://github.com/jkrumm/free-planning-poker/commit/0208874d6e9b29be1842453f45f84be0102ee4cd))


### Other Changes

* updated dependencies ([b05932d](https://github.com/jkrumm/free-planning-poker/commit/b05932d10a8569e4cfb01c642a8929b34685d8b0))

## [3.0.2](https://github.com/jkrumm/free-planning-poker/compare/3.0.1...3.0.2) (2024-05-06)


### Other Changes

* updated imprint ([10b275a](https://github.com/jkrumm/free-planning-poker/commit/10b275a89e96e142f3e59744eacad420cf1dcd90))
* upgrade to Node 20 ([ca0e753](https://github.com/jkrumm/free-planning-poker/commit/ca0e753feb51d016d292f023c65d7f67cdf70bf3))

## [3.0.1](https://github.com/jkrumm/free-planning-poker/compare/3.0.0...3.0.1) (2024-05-05)


### Other Changes

* transition to sideproject-docker-stack & Doppler secrets ([202e2fd](https://github.com/jkrumm/free-planning-poker/commit/202e2fd4eb117b65701a36794f3fcc716b753fe7))
* update dependencies ([2cf402c](https://github.com/jkrumm/free-planning-poker/commit/2cf402c228481ad3792d037ce6547912d48462d8))
* upgrade packages ([4757e2d](https://github.com/jkrumm/free-planning-poker/commit/4757e2d74c51dfd4c05ada1654a0433cb48b0fce))
* upgrade to NextJs 14 & remove Axiom ([c7cfefe](https://github.com/jkrumm/free-planning-poker/commit/c7cfefe651140a4400afc23a7dd34c36f44b809b))

## [3.0.0](https://github.com/jkrumm/free-planning-poker/compare/2.3.0...3.0.0) (2024-02-08)


### Features

* **v3:** play sound effects ([41a69dd](https://github.com/jkrumm/free-planning-poker/commit/41a69dd8f27b9e1e8d0eddc719d00d8b0da26fbf))
* **v3:** room sidebar & room analytics sidebar ([11a29a6](https://github.com/jkrumm/free-planning-poker/commit/11a29a6de31343fec7585c9027717259e739661a))
* **v3:** user settings sidebar to change username ([30e2d5b](https://github.com/jkrumm/free-planning-poker/commit/30e2d5be3f2a001192d9e676b0949fa47b6029d4))
* **v3:** vote duration counter ([50d8c10](https://github.com/jkrumm/free-planning-poker/commit/50d8c10e575dbd14255f66187c881c28cc59ec6a))


### Bug Fixes

* **analytics:** estimations not parsed to int due to spectators ([1c083a2](https://github.com/jkrumm/free-planning-poker/commit/1c083a2cf8b207f0ee48dc00ae1f519027f2887b))
* deffer state updates causing issues for google indexing ([9bee393](https://github.com/jkrumm/free-planning-poker/commit/9bee3932708e70b20a5b68e9150a4d0991d274d2))
* heartbeat now keeps room alive ([623a5ee](https://github.com/jkrumm/free-planning-poker/commit/623a5ee10761dd0ac4f47fed7adfe719161b9071))
* show player cards after vote ([635ddeb](https://github.com/jkrumm/free-planning-poker/commit/635ddebaf999dca7e5e92e905fa9aecbb1976dad))
* **v3:** notify before local room state update ([03c3ecc](https://github.com/jkrumm/free-planning-poker/commit/03c3ecc184183f29d1c93725773e3d718c0c72ec))


### Other Changes

* update dependencies ([06623cc](https://github.com/jkrumm/free-planning-poker/commit/06623cc03fdda6fe588889df09faf49fea247f47))

## [2.3.0](https://github.com/jkrumm/free-planning-poker/compare/2.2.0...2.3.0) (2024-01-27)


### Features

* **analytics:** calculate accumulating historical data & total votes historical ([1f1d18c](https://github.com/jkrumm/free-planning-poker/commit/1f1d18ca26994b1ff58ec0bb15f8583a5acb0838))
* **analytics:** durations format and append minutes ([b6d2aa1](https://github.com/jkrumm/free-planning-poker/commit/b6d2aa1387ee71e2cb017d793a97ad6c43b7e672))
* **analytics:** switch to ag charts ([93346e4](https://github.com/jkrumm/free-planning-poker/commit/93346e4d0cc89e744728d7611716a1ee4be5dedc))


### Bug Fixes

* bugs in the heartbeat method and flip mutation ([14a0073](https://github.com/jkrumm/free-planning-poker/commit/14a0073a088bf24e4bc86962e739fdf6a3554d04))


### Other Changes

* integrated knip and little code cleanup ([af88dad](https://github.com/jkrumm/free-planning-poker/commit/af88dade5bf3c66394a25f6e46587479b8b257ec))
* update dependencies ([ed04c98](https://github.com/jkrumm/free-planning-poker/commit/ed04c98a9c25e3d9f1c4e1a738106f1010aed1bc))

## [2.2.0](https://github.com/jkrumm/free-planning-poker/compare/2.1.0...2.2.0) (2024-01-22)


### Features

* **analytics:** adjusted analytics page to new data model ([35a9424](https://github.com/jkrumm/free-planning-poker/commit/35a942453f51f4856e449f11a063a648e97df231))
* **analytics:** all scripts for analytics calculation ([d269027](https://github.com/jkrumm/free-planning-poker/commit/d26902715e92ffaa038dc607daa19cd5479fa60e))
* **analytics:** behaviour in analytics ([f7a7c22](https://github.com/jkrumm/free-planning-poker/commit/f7a7c22f93ba6f437298f0bcb9abfb5d496b1b5b))
* **analytics:** python setup & read model sync & logger ([70819fb](https://github.com/jkrumm/free-planning-poker/commit/70819fbef9fc24e3f51222f25f6c371150aa8327))
* **analytics:** seperated user read model sync ([0fcbe3c](https://github.com/jkrumm/free-planning-poker/commit/0fcbe3cf8acbbd81e1a5c6726c46cabbd9df398b))
* fetch GitHub latest tag server side and cache in Redis ([cda98c6](https://github.com/jkrumm/free-planning-poker/commit/cda98c6881f2697473362832365835b6e02762b9))


### Continuous Integration

* **analytics:** automatically deploy analytics to domcloud ([f3a6865](https://github.com/jkrumm/free-planning-poker/commit/f3a6865fbabada65cc9d4ce807227831e0d547ad))


### Other Changes

* delete packages not used anymore ([4865171](https://github.com/jkrumm/free-planning-poker/commit/48651717e78b5da0d853c01354b4cfe8fc0bc3e9))
* tailwind always dark theme ([68aeb0e](https://github.com/jkrumm/free-planning-poker/commit/68aeb0edfd68836320a6e2a94ea71a79039e259d))

## [2.1.0](https://github.com/jkrumm/free-planning-poker/compare/2.0.0...2.1.0) (2024-01-19)


### Features

* fetch latest tag and show in footer ([5a7e559](https://github.com/jkrumm/free-planning-poker/commit/5a7e5594dfc63e40641272b28c40657226cc3ba3))
* update room lastUsedAt on vote and join ([d3a4605](https://github.com/jkrumm/free-planning-poker/commit/d3a460532ec6bd7cf2477c36954950cfb4947d5c))


### Bug Fixes

* correct NanoId validation and better reassignment ([8b5fa44](https://github.com/jkrumm/free-planning-poker/commit/8b5fa444b93317d8e9b973811bb8663c7d52615d))


### Continuous Integration

* automatic Semantic Release on merge to master ([f33d7ad](https://github.com/jkrumm/free-planning-poker/commit/f33d7adec368cef9423674cb5ca86fb1ce620329))
* delete automatic Semantic Release ([562fef9](https://github.com/jkrumm/free-planning-poker/commit/562fef93946771c4fa718da17cd3dd65a74297d9))

## [2.0.0](https://github.com/jkrumm/free-planning-poker/compare/1.0.0...2.0.0) (2024-01-19)


### Features

* **v2:** added notifications & fixed tracking and room join ([150bf92](https://github.com/jkrumm/free-planning-poker/commit/150bf92a55c41cbd84016be3c995529a23cc5768))
* **v2:** optimized room-state implementation ([3f6b30f](https://github.com/jkrumm/free-planning-poker/commit/3f6b30f05752c930afd03e9929aa735db893e7a7))
* **v2:** room state persisted in Redis & TRPC endpoints to update state ([91b72b4](https://github.com/jkrumm/free-planning-poker/commit/91b72b4ca7c01240e54a30edb9593ae43a8565bf)), closes [#65](https://github.com/jkrumm/free-planning-poker/issues/65)
* **v2:** switch to mysql with Planetscale database & better schema ([8b54207](https://github.com/jkrumm/free-planning-poker/commit/8b54207560bf870ae058074893f2540d318e6f13))
* **v2:** vote and estimation tracking ([07da824](https://github.com/jkrumm/free-planning-poker/commit/07da824726f5a25c487c877f0c991f884923a780))


### Bug Fixes

* various issues through feat v2 ([41920a9](https://github.com/jkrumm/free-planning-poker/commit/41920a9363df09841e820f4440c8e086691b720c))


### Documentation

* automatic changelog using release-it and conventional commits ([417e12a](https://github.com/jkrumm/free-planning-poker/commit/417e12a2e40a8052ef5f9b8b9242975409697d63))
* improve release-it configurations ([36fe94d](https://github.com/jkrumm/free-planning-poker/commit/36fe94dcde8086179260c3f35cd25ee09c5de975))


### Other Changes

* import sort using Prettier ([4f2c941](https://github.com/jkrumm/free-planning-poker/commit/4f2c9410db67a40b165acf1f992c4a066a270e9d))
