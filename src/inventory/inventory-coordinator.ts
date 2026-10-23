import {
  createReservation,
  transitionReservation,
  type Reservation,
} from './reservation'

export interface ProductStock {
  productId: string
  quantity: number
}

export interface InventoryCoordinatorOptions {
  reservationTtlMs: number
  now?: () => number
  createReservationId?: () => string
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | {
      ok: false
      reason: 'invalid-quantity' | 'product-not-found' | 'out-of-stock'
    }

export type CheckoutResult =
  | { ok: true; reservation: Reservation }
  | {
      ok: false
      reason: 'reservation-not-found' | 'reservation-expired' | 'already-checked-out'
    }

const browserNow = () => Date.now()

function createRandomReservationId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('crypto.randomUUID is required to create reservation IDs')
  }
  return globalThis.crypto.randomUUID()
}

/**
 * In-memory inventory coordinator for one JavaScript runtime. This does not
 * provide a distributed lock across browser tabs, processes, or servers.
 */
export class InventoryCoordinator {
  private readonly availableStock = new Map<string, number>()
  private readonly reservations = new Map<string, Reservation>()
  private readonly reservationTtlMs: number
  private readonly now: () => number
  private readonly createReservationId: () => string

  constructor(
    initialStock: readonly ProductStock[],
    options: InventoryCoordinatorOptions,
  ) {
    if (!Number.isFinite(options.reservationTtlMs) || options.reservationTtlMs <= 0) {
      throw new RangeError('reservationTtlMs must be a positive finite number')
    }

    this.reservationTtlMs = options.reservationTtlMs
    this.now = options.now ?? browserNow
    this.createReservationId = options.createReservationId ?? createRandomReservationId

    for (const item of initialStock) {
      if (!item.productId.trim()) throw new TypeError('productId must not be empty')
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 0) {
        throw new RangeError('initial stock must be a non-negative safe integer')
      }
      if (this.availableStock.has(item.productId)) {
        throw new TypeError(`duplicate stock entry for product ${item.productId}`)
      }

      this.availableStock.set(item.productId, item.quantity)
    }
  }

  getAvailableStock(productId: string): number | undefined {
    return this.availableStock.get(productId)
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId)
  }

  listReservations(): readonly Reservation[] {
    return [...this.reservations.values()]
  }

  /**
   * Synchronously checks and decrements stock in the same call stack. There
   * is deliberately no await between the availability check and both writes.
   */
  reserve(productId: string, quantity = 1): ReserveResult {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' }
    }

    const nowMs = this.now()
    this.assertValidTime(nowMs)
    this.expireDueReservationsAt(nowMs)

    if (!this.availableStock.has(productId)) {
      return { ok: false, reason: 'product-not-found' }
    }

    const reservationId = this.createReservationId()
    if (!reservationId.trim()) throw new TypeError('reservation ID must not be empty')
    if (this.reservations.has(reservationId)) {
      throw new TypeError(`duplicate reservation ID ${reservationId}`)
    }

    const expiresAt = nowMs + this.reservationTtlMs
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
      throw new RangeError('reservation expiry must be a finite future timestamp')
    }

    const available = this.availableStock.get(productId)!
    if (available < quantity) return { ok: false, reason: 'out-of-stock' }

    const reservation = Object.freeze(
      createReservation({ id: reservationId, productId, quantity, expiresAt }),
    )

    // Keep the stock check and both inventory writes synchronous and adjacent.
    this.availableStock.set(productId, available - quantity)
    this.reservations.set(reservationId, reservation)
    return { ok: true, reservation }
  }

  /**
   * Synchronously commits checkout only while the reservation is active and
   * now is strictly before expiresAt. At the exact deadline expiry wins.
   */
  checkout(reservationId: string): CheckoutResult {
    const nowMs = this.now()
    this.assertValidTime(nowMs)

    const reservation = this.reservations.get(reservationId)
    if (!reservation) return { ok: false, reason: 'reservation-not-found' }
    if (reservation.status === 'expired') {
      return { ok: false, reason: 'reservation-expired' }
    }
    if (reservation.status === 'checked-out') {
      return { ok: false, reason: 'already-checked-out' }
    }

    if (nowMs >= reservation.expiresAt) {
      this.expireDueReservationsAt(nowMs)
      return { ok: false, reason: 'reservation-expired' }
    }

    const transition = transitionReservation(reservation, { type: 'checkout' }, nowMs)
    if (!transition.accepted) return { ok: false, reason: 'reservation-expired' }

    const checkedOut = Object.freeze(transition.reservation)
    this.reservations.set(reservationId, checkedOut)
    return { ok: true, reservation: checkedOut }
  }

  /** Expires all due reservations and restores each reservation's stock once. */
  expireDueReservations(nowMs: number = this.now()): readonly Reservation[] {
    this.assertValidTime(nowMs)
    return this.expireDueReservationsAt(nowMs)
  }

  private expireDueReservationsAt(nowMs: number): readonly Reservation[] {
    const newlyExpired: Reservation[] = []

    for (const [reservationId, reservation] of this.reservations) {
      if (reservation.status !== 'active' || nowMs < reservation.expiresAt) continue

      const transition = transitionReservation(reservation, { type: 'expire' }, nowMs)
      if (!transition.accepted) continue

      const expired = Object.freeze(transition.reservation)
      const available = this.availableStock.get(reservation.productId)
      if (available === undefined) {
        throw new Error(`missing stock record for product ${reservation.productId}`)
      }

      this.reservations.set(reservationId, expired)
      this.availableStock.set(reservation.productId, available + reservation.quantity)
      newlyExpired.push(expired)
    }

    return newlyExpired
  }

  private assertValidTime(nowMs: number): void {
    if (!Number.isFinite(nowMs)) throw new RangeError('clock must return a finite timestamp')
  }
}
