import { describe, expect, it } from 'vitest'
import { InventoryCoordinator } from '../inventory-coordinator'

function createCoordinator(stock = 3) {
  let nowMs = 100
  let id = 0
  const coordinator = new InventoryCoordinator(
    [{ productId: 'phone-1', quantity: stock }],
    {
      reservationTtlMs: 500,
      now: () => nowMs,
      createReservationId: () => `reservation-${++id}`,
    },
  )

  return {
    coordinator,
    setNow: (nextNowMs: number) => {
      nowMs = nextNowMs
    },
  }
}

describe('InventoryCoordinator reserve and expiry', () => {
  it('reserves available stock with a stable ID and injected expiry time', () => {
    const { coordinator } = createCoordinator()
    const result = coordinator.reserve('phone-1', 2)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected reservation to succeed')
    expect(result.reservation).toMatchObject({
      id: 'reservation-1',
      productId: 'phone-1',
      quantity: 2,
      expiresAt: 600,
      status: 'active',
    })
    expect(coordinator.getAvailableStock('phone-1')).toBe(1)
    expect(coordinator.getReservation('reservation-1')).toBe(result.reservation)
  })

  it('rejects out-of-stock, unknown products, and invalid quantity without overselling', () => {
    const { coordinator } = createCoordinator(1)

    expect(coordinator.reserve('phone-1', 2)).toEqual({ ok: false, reason: 'out-of-stock' })
    expect(coordinator.reserve('unknown')).toEqual({ ok: false, reason: 'product-not-found' })
    expect(coordinator.reserve('phone-1', 0)).toEqual({ ok: false, reason: 'invalid-quantity' })
    expect(coordinator.getAvailableStock('phone-1')).toBe(1)
    expect(coordinator.listReservations()).toHaveLength(0)
  })

  it('serializes simultaneous reserve calls in this runtime without overselling', async () => {
    const { coordinator } = createCoordinator(7)
    const results = await Promise.all(
      Array.from({ length: 40 }, async () => coordinator.reserve('phone-1')),
    )
    const successful = results.filter((result) => result.ok)

    expect(successful).toHaveLength(7)
    expect(coordinator.getAvailableStock('phone-1')).toBe(0)
    expect(coordinator.listReservations()).toHaveLength(7)
    expect(new Set(successful.map((result) => result.ok && result.reservation.id)).size).toBe(7)
    expect(results.filter((result) => !result.ok)).toHaveLength(33)
  })

  it('expires at the exact deadline and restores stock exactly once', () => {
    const { coordinator, setNow } = createCoordinator(5)
    const result = coordinator.reserve('phone-1', 3)
    if (!result.ok) throw new Error('expected reservation to succeed')

    setNow(599)
    expect(coordinator.expireDueReservations()).toEqual([])
    expect(coordinator.getAvailableStock('phone-1')).toBe(2)

    setNow(600)
    expect(coordinator.expireDueReservations()).toMatchObject([
      { id: result.reservation.id, status: 'expired', quantity: 3 },
    ])
    expect(coordinator.getReservation(result.reservation.id)?.status).toBe('expired')
    expect(coordinator.getAvailableStock('phone-1')).toBe(5)

    expect(coordinator.expireDueReservations()).toEqual([])
    expect(coordinator.expireDueReservations(10_000)).toEqual([])
    expect(coordinator.getAvailableStock('phone-1')).toBe(5)
  })

  it('releases an expired lock before attempting a later reserve', () => {
    const { coordinator, setNow } = createCoordinator(1)
    const first = coordinator.reserve('phone-1')
    if (!first.ok) throw new Error('expected first reservation to succeed')

    setNow(first.reservation.expiresAt)
    const second = coordinator.reserve('phone-1')

    expect(second.ok).toBe(true)
    expect(coordinator.getReservation(first.reservation.id)?.status).toBe('expired')
    expect(coordinator.getAvailableStock('phone-1')).toBe(0)
  })

  it('rejects invalid clock readings without corrupting stock', () => {
    const { coordinator, setNow } = createCoordinator()
    setNow(Number.NaN)

    expect(() => coordinator.reserve('phone-1')).toThrow(RangeError)
    expect(() => coordinator.expireDueReservations()).toThrow(RangeError)
    expect(coordinator.getAvailableStock('phone-1')).toBe(3)
  })
})
