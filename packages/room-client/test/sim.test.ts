/**
 * The client against the simulator's lossy transport (docs/plan.yaml, v9-room-client, acceptance 1 and 4): bots built
 * on the real client sit at the real runtime while the network drops, repeats, reorders and cuts; the client's view
 * is the server's projection whenever it is caught up, and once the network calms every client is.
 */
import { describe, expect, test } from 'bun:test'
import { PROFILES } from '@fpp/room-core/sim'
import { project } from '@fpp/room-core/server'
import { startBots } from '../src/bots.ts'
import { createRoomClient } from '../src/index.ts'
import { ADDRESS, playBots, world } from './sim-harness.ts'

const SEEDS = 500

describe('the client on the simulator', () => {
  test(`${SEEDS} seeds of connect, vote, drop and resume end with the view equal to the projection`, async () => {
    let compared = 0
    let reveals = 0
    let resumes = 0
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const { w, bots } = await playBots({ seed })
      const room = w.inspect()!
      const problems = [...w.check.violations, ...w.violations]
      for (const client of bots.clients) {
        const state = client.state.getSnapshot()
        if (state.status !== 'live') problems.push(`a client ends ${state.status}`)
        else if (state.seq !== room.seq || state.pending.length > 0)
          problems.push(
            `a client ends at seq ${state.seq} of ${room.seq} with ${state.pending.length} pending`,
          )
        else if (!Bun.deepEquals(state.view, project(room.state, state.view!.self), true))
          problems.push('a client ends with a view that is not the projection')
      }
      if (problems.length > 0) throw new Error(`seed ${seed}:\n  ${problems.join('\n  ')}`)
      compared += w.caughtUp()
      reveals += w.check.stats.reveals
      resumes += w.check.stats.resumes
      bots.stop()
    }
    // The comparison ran a great many times, over rounds that were revealed.
    expect(compared).toBeGreaterThan(SEEDS * 20)
    expect(reveals).toBeGreaterThan(SEEDS * 2)
    expect(resumes).toBeGreaterThan(SEEDS * 3)
    console.log(
      `${SEEDS} seeds: ${compared} caught-up views equal the projection, ${reveals} reveals`,
    )
  }, 120_000)

  test('seed 1 is a pure function of its seed', async () => {
    const first = await playBots({ seed: 1 })
    const second = await playBots({ seed: 1 })
    expect(JSON.stringify(first.w.inspect()!.state)).toBe(JSON.stringify(second.w.inspect()!.state))
    first.bots.stop()
    second.bots.stop()
  })
})

describe('a round through the runtime', () => {
  test('two seats vote, reveal and settle, each seeing the other only after the reveal', async () => {
    const w = world(11, PROFILES.calm)
    const ask = (n: number, name: string) =>
      createRoomClient({
        slug: ADDRESS,
        profile: { name, avatar: name },
        origin: 'http://sim.test',
        ports: w.portsFor(n),
      })
    const ada = ask(0, 'Ada')
    const bo = ask(1, 'Bo')
    w.watched.push(ada, bo)
    await w.advance(1000)
    expect(ada.state.getSnapshot().status).toBe('live')
    expect(bo.state.getSnapshot().status).toBe('live')
    expect(ada.state.getSnapshot().view!.seats).toHaveLength(2)

    const round = ada.state.getSnapshot().view!.activity.current
    const voted = Promise.all([
      ada.send({ type: 'poker.vote', payload: { round, card: '5' } }),
      bo.send({ type: 'poker.vote', payload: { round, card: '8' } }),
    ])
    expect(ada.state.getSnapshot().pendingVote).toEqual({ round, card: '5' })
    await w.advance(1000)
    expect(await voted).toEqual([{ ok: true }, { ok: true }])

    const hidden = ada.state.getSnapshot().view!.activity.rounds[0]!
    expect(hidden.state).toBe('voting')
    expect(hidden.votes.map((vote) => vote.card?.label ?? null).toSorted()).toEqual(['5', null])
    expect(ada.state.getSnapshot().pendingVote).toBeNull()

    const revealed = ada.send({ type: 'poker.reveal', payload: { round } })
    await w.advance(1000)
    expect(await revealed).toEqual({ ok: true })
    for (const client of [ada, bo]) {
      const shown = client.state.getSnapshot().view!.activity.rounds[0]!
      expect(shown.state).toBe('revealed')
      expect(shown.votes.map((vote) => vote.card?.label).toSorted()).toEqual(['5', '8'])
    }

    const settled = bo.send({ type: 'poker.settle', payload: { round, card: '8' } })
    await w.advance(1000)
    expect(await settled).toEqual({ ok: true })
    const topic = ada.state.getSnapshot().view!.topics[0]!
    expect(topic.final).toMatchObject({ label: '8', decidedBy: 'settled' })
    expect(w.check.violations).toEqual([])
    expect(w.violations).toEqual([])
    ada.dispose()
    bo.dispose()
  })

  test('a seat that loses its connection comes back to the same seat with its vote', async () => {
    const w = world(12, PROFILES.calm)
    const ada = createRoomClient({
      slug: ADDRESS,
      profile: { name: 'Ada', avatar: 'ada' },
      origin: 'http://sim.test',
      ports: w.portsFor(0),
    })
    w.watched.push(ada)
    await w.advance(1000)
    const seat = ada.state.getSnapshot().view!.self
    const round = ada.state.getSnapshot().view!.activity.current
    void ada.send({ type: 'poker.vote', payload: { round, card: '3' } })
    await w.advance(1000)
    w.signals[0]!.goOnline()
    await w.advance(2000)
    const view = ada.state.getSnapshot().view!
    expect(view.self).toBe(seat)
    expect(view.seats).toHaveLength(1)
    expect(view.activity.rounds[0]!.votes[0]).toMatchObject({ seat, card: { label: '3' } })
    expect(w.violations).toEqual([])
    ada.dispose()
  })
})

describe('the bots entry', () => {
  test('twelve bots seated through it see a reveal', async () => {
    const w = world(21, PROFILES.calm)
    const bots = startBots({
      origin: 'http://sim.test',
      room: ADDRESS,
      seats: 12,
      behaviour: 'quick',
      speed: 4,
      portsFor: w.portsFor,
      random: w.rng.next,
    })
    const revealed = () =>
      bots.clients.filter((client) =>
        client.state
          .getSnapshot()
          .view?.activity.rounds.some((round) => round.state === 'revealed'),
      )
    for (let second = 0; second < 120 && revealed().length === 0; second += 1) {
      await w.advance(1000)
      for (const client of bots.clients) if (!w.watched.includes(client)) w.watched.push(client)
    }
    expect(bots.clients).toHaveLength(12)
    expect(revealed().length).toBeGreaterThan(0)
    expect(w.inspect()!.state.seats).toHaveLength(12)
    await w.advance(2000)
    expect(
      bots.clients.filter((client) => client.state.getSnapshot().status === 'live'),
    ).toHaveLength(12)
    expect(w.check.violations).toEqual([])
    expect(w.violations).toEqual([])
    bots.stop()
  })
})
