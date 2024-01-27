

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
