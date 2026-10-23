import { describe, expect, it } from 'vitest'
import { InventoryCoordinator } from '../inventory-coordinator'

function setup() {
  let nowMs = 100
  const coordinator = new InventoryCoordinator(
    [{ productId: 'phone-1', quantity: 2 }],
    {
      reservationTtlMs: 100,
      now: () => nowMs,
      createReservationId: () => 'reservation-1',
    },
  )
  const reserved = coordinator.reserve('phone-1')
  if (!reserved.ok) throw new Error('test setup could not reserve stock')

  return {
    coordinator,
    reservationId: reserved.reservation.id,
    expiresAt: reserved.reservation.expiresAt,
    setNow: (value: number) => {
      nowMs = value
    },
  }
}

describe('reservation checkout', () => {
  it('checks out an active reservation strictly before expiry', () => {
    const { coordinator, reservationId, expiresAt, setNow } = setup()
    setNow(expiresAt - 1)

    const result = coordinator.checkout(reservationId)

    expect(result).toMatchObject({
      ok: true,
      reservation: { id: reservationId, status: 'checked-out' },
    })
    expect(coordinator.getReservation(reservationId)?.status).toBe('checked-out')
    expect(coordinator.getAvailableStock('phone-1')).toBe(1)
  })

  it('treats the exact expiresAt boundary as expired and rejects checkout', () => {
    const { coordinator, reservationId, expiresAt, setNow } = setup()
    setNow(expiresAt)

    expect(coordinator.checkout(reservationId)).toEqual({
      ok: false,
      reason: 'reservation-expired',
    })
    expect(coordinator.getReservation(reservationId)?.status).toBe('expired')
    expect(coordinator.getAvailableStock('phone-1')).toBe(2)
  })

  it('rejects checkout after an expiry sweep has already won', () => {
    const { coordinator, reservationId, expiresAt, setNow } = setup()
    setNow(expiresAt)
    coordinator.expireDueReservations()

    expect(coordinator.checkout(reservationId)).toEqual({
      ok: false,
      reason: 'reservation-expired',
    })
    expect(coordinator.getAvailableStock('phone-1')).toBe(2)
  })

  it('allows a successful checkout only once and leaves stock unchanged on retry', () => {
    const { coordinator, reservationId } = setup()

    expect(coordinator.checkout(reservationId).ok).toBe(true)
    expect(coordinator.checkout(reservationId)).toEqual({
      ok: false,
      reason: 'already-checked-out',
    })
    expect(coordinator.getAvailableStock('phone-1')).toBe(1)
    expect(coordinator.getReservation(reservationId)?.status).toBe('checked-out')
  })

  it('keeps a checkout that wins before expiry from being refunded by a later expiry callback', () => {
    const { coordinator, reservationId, expiresAt, setNow } = setup()
    setNow(expiresAt - 1)

    expect(coordinator.checkout(reservationId).ok).toBe(true)
    setNow(expiresAt)

    expect(coordinator.expireDueReservations()).toEqual([])
    expect(coordinator.getAvailableStock('phone-1')).toBe(1)
  })

  it('rejects checkout when expiry runs first in the race', () => {
    const { coordinator, reservationId, expiresAt, setNow } = setup()
    setNow(expiresAt)

    expect(coordinator.expireDueReservations()).toHaveLength(1)
    expect(coordinator.checkout(reservationId)).toEqual({
      ok: false,
      reason: 'reservation-expired',
    })
    expect(coordinator.getAvailableStock('phone-1')).toBe(2)
  })
})
