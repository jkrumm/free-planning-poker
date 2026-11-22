/** A locked room: the invite link carries the password in its fragment, a bare link is asked for it. */
import { expect, ownSeat, test } from './room.ts'

test(
  'a locked room seats the invite link and asks everyone else for the password',
  { tag: '@smoke' },
  async ({ room }) => {
    const { seats, slug, join, visit } = await room(1)
    const [owner] = seats
    if (owner === undefined) throw new Error('one seat')

    await owner.page.getByTestId('lock-generated').click()
    await expect(owner.page.getByTestId('access-state')).toHaveAttribute('data-access', 'locked')
    const code = (await owner.page.getByTestId('access-code').textContent()) ?? ''
    expect(code.length, 'a generated password').toBeGreaterThan(1)
    const invite = await owner.page.getByTestId('invite-link').inputValue()
    expect(invite.endsWith(`/room/${slug}#${encodeURIComponent(code)}`)).toBe(true)

    // The invite link seats a second context with no prompt for the password.
    const guest = await join('Guest', { url: invite })
    await expect(guest.page.getByTestId('code-input')).toHaveCount(0)
    await expect(owner.page.getByTestId('seat')).toHaveCount(2)

    // The bare link is refused without the password and with a wrong one, and takes the right one.
    const stranger = await visit(`/room/${slug}`)
    await stranger.page.getByTestId('name-input').fill('Stranger')
    await stranger.page.getByTestId('join-room').click()
    await expect(stranger.page.getByTestId('status')).toHaveAttribute('data-status', 'locked')
    await expect(stranger.page.getByTestId('seat')).toHaveCount(0)
    await stranger.page.getByTestId('code-input').fill(`${code}-wrong`)
    await stranger.page.getByTestId('code-submit').click()
    await expect(stranger.page.getByTestId('code-refused')).toBeVisible()
    await expect(stranger.page.getByTestId('status')).toHaveAttribute('data-status', 'locked')
    await expect(owner.page.getByTestId('seat')).toHaveCount(2)

    await stranger.page.getByTestId('code-input').fill(code)
    await stranger.page.getByTestId('code-submit').click()
    await expect(stranger.page.getByTestId('status')).toHaveAttribute('data-status', 'live')
    await expect(owner.page.getByTestId('seat')).toHaveCount(3)

    // The seat is remembered: a reload is not asked again.
    await stranger.page.reload()
    await expect(stranger.page.getByTestId('status')).toHaveAttribute('data-status', 'live')
    await expect(stranger.page.getByTestId('code-input')).toHaveCount(0)
    await expect(ownSeat(stranger.page)).toHaveCount(1)
    await expect(owner.page.getByTestId('seat')).toHaveCount(3)
  },
)
