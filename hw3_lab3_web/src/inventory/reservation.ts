export type ReservationStatus = 'active' | 'checked-out' | 'expired'

export interface Reservation {
  readonly id: string
  readonly productId: string
  readonly quantity: number
  readonly expiresAt: number
  readonly status: ReservationStatus
}

export interface NewReservation {
  id: string
  productId: string
  quantity: number
  expiresAt: number
}

export type ReservationEvent = { type: 'checkout' } | { type: 'expire' }

export type ReservationTransitionFailureReason =
  | 'reservation-not-active'
  | 'reservation-expired'
  | 'reservation-not-expired'

export type ReservationTransitionResult =
  | { accepted: true; reservation: Reservation }
  | {
      accepted: false
      reservation: Reservation
      reason: ReservationTransitionFailureReason
    }

/** Creates an active reservation after validating its stable identity and values. */
export function createReservation(input: NewReservation): Reservation {
  if (!input.id.trim()) throw new TypeError('reservation id must not be empty')
  if (!input.productId.trim()) throw new TypeError('productId must not be empty')
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new RangeError('quantity must be a positive safe integer')
  }
  if (!Number.isFinite(input.expiresAt)) {
    throw new RangeError('expiresAt must be a finite timestamp')
  }

  return { ...input, status: 'active' }
}

/**
 * Applies one reservation event using the caller-provided clock value.
 * Checkout is allowed strictly before expiresAt; expiry is allowed at or
 * after expiresAt. Rejected events leave the reservation unchanged.
 */
export function transitionReservation(
  reservation: Reservation,
  event: ReservationEvent,
  nowMs: number,
): ReservationTransitionResult {
  if (!Number.isFinite(nowMs)) throw new RangeError('nowMs must be a finite timestamp')

  if (reservation.status !== 'active') {
    return { accepted: false, reservation, reason: 'reservation-not-active' }
  }

  if (event.type === 'checkout') {
    if (nowMs >= reservation.expiresAt) {
      return { accepted: false, reservation, reason: 'reservation-expired' }
    }

    return {
      accepted: true,
      reservation: { ...reservation, status: 'checked-out' },
    }
  }

  if (nowMs < reservation.expiresAt) {
    return { accepted: false, reservation, reason: 'reservation-not-expired' }
  }

  return {
    accepted: true,
    reservation: { ...reservation, status: 'expired' },
  }
}
