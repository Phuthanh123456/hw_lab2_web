import { describe, expect, it } from 'vitest'
import {
  createReservation,
  transitionReservation,
  type Reservation,
} from '../reservation'

const reservation = (
  overrides: Partial<Omit<Reservation, 'status'>> = {},
): Reservation =>
  createReservation({
    id: 'reservation-1',
    productId: 'phone-1',
    quantity: 2,
    expiresAt: 1_000,
    ...overrides,
  })

describe('reservation state transitions', () => {
  it('creates an active reservation with stable identity and expiry', () => {
    expect(reservation()).toEqual({
      id: 'reservation-1',
      productId: 'phone-1',
      quantity: 2,
      expiresAt: 1_000,
      status: 'active',
    })
  })

  it('checks out an active reservation strictly before expiry', () => {
    const initial = reservation()
    const result = transitionReservation(initial, { type: 'checkout' }, 999)

    expect(result).toEqual({
      accepted: true,
      reservation: { ...initial, status: 'checked-out' },
    })
    expect(initial.status).toBe('active')
  })

  it.each([1_000, 1_001])('expires an active reservation at/after deadline (%i)', (nowMs) => {
    const initial = reservation()
    const result = transitionReservation(initial, { type: 'expire' }, nowMs)

    expect(result).toEqual({
      accepted: true,
      reservation: { ...initial, status: 'expired' },
    })
  })

  it('rejects checkout at the expiry boundary without changing the state', () => {
    const initial = reservation()

    expect(transitionReservation(initial, { type: 'checkout' }, 1_000)).toEqual({
      accepted: false,
      reservation: initial,
      reason: 'reservation-expired',
    })
  })

  it('rejects expiry before the deadline without changing the state', () => {
    const initial = reservation()

    expect(transitionReservation(initial, { type: 'expire' }, 999)).toEqual({
      accepted: false,
      reservation: initial,
      reason: 'reservation-not-expired',
    })
  })

  it.each([
    ['checked-out', { type: 'expire' }, 1_000],
    ['expired', { type: 'checkout' }, 500],
  ] as const)('rejects transitions from terminal state %s', (status, event, nowMs) => {
    const initial: Reservation = { ...reservation(), status }

    expect(transitionReservation(initial, event, nowMs)).toEqual({
      accepted: false,
      reservation: initial,
      reason: 'reservation-not-active',
    })
  })

  it('validates reservation fields and the injected time', () => {
    expect(() => createReservation({ ...reservation(), id: ' ' })).toThrow(TypeError)
    expect(() => createReservation({ ...reservation(), quantity: 0 })).toThrow(RangeError)
    expect(() => createReservation({ ...reservation(), expiresAt: Number.NaN })).toThrow(RangeError)
    expect(() => transitionReservation(reservation(), { type: 'expire' }, Number.NaN)).toThrow(
      RangeError,
    )
  })
})
