import { describe, expect, it, vi } from 'vitest'
import { InventoryCoordinator } from '../../inventory/inventory-coordinator'
import {
  startCountdown,
  type CountdownFrameScheduler,
} from '../../timer/countdown-scheduler'

function createInventory(stock: number, ttlMs: number) {
  let nowMs = 1_000
  let nextId = 0
  const coordinator = new InventoryCoordinator(
    [{ productId: 'limited-phone', quantity: stock }],
    {
      reservationTtlMs: ttlMs,
      now: () => nowMs,
      createReservationId: () => `reservation-${++nextId}`,
    },
  )

  return {
    coordinator,
    setNow: (timeMs: number) => {
      nowMs = timeMs
    },
  }
}

function createFrameScheduler(initialNowMs: number) {
  let nowMs = initialNowMs
  let nextFrameId = 0
  const pending = new Map<number, FrameRequestCallback>()
  const cancelled: number[] = []
  const scheduler: CountdownFrameScheduler = {
    now: () => nowMs,
    requestAnimationFrame: (callback) => {
      const id = ++nextFrameId
      pending.set(id, callback)
      return id
    },
    cancelAnimationFrame: (id) => {
      cancelled.push(id)
      pending.delete(id)
    },
  }

  return {
    scheduler,
    setNow: (timeMs: number) => {
      nowMs = timeMs
    },
    pendingCount: () => pending.size,
    nextFrame: () => {
      const next = pending.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (!next) throw new Error('No animation frame is pending')
      pending.delete(next[0])
      next[1](nowMs)
    },
    pendingEntry: () => pending.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined,
    cancelled,
  }
}

describe('flash-sale countdown and inventory lifecycle integration', () => {
  it('does not reserve more units than available under concurrent requests', async () => {
    const stock = 8
    const { coordinator } = createInventory(stock, 5_000)

    const results = await Promise.all(
      Array.from({ length: 60 }, async () => coordinator.reserve('limited-phone')),
    )
    const successful = results.filter((result) => result.ok)

    expect(successful).toHaveLength(stock)
    expect(coordinator.getAvailableStock('limited-phone')).toBe(0)
    expect(coordinator.getAvailableStock('limited-phone')).toBeGreaterThanOrEqual(0)
    expect(coordinator.listReservations()).toHaveLength(stock)
    expect(new Set(successful.map((result) => result.ok && result.reservation.id)).size).toBe(stock)
  })

  it('returns expired stock once even when expiry is processed repeatedly', () => {
    const { coordinator, setNow } = createInventory(10, 250)
    const result = coordinator.reserve('limited-phone', 4)
    if (!result.ok) throw new Error('test setup could not reserve stock')

    expect(coordinator.getAvailableStock('limited-phone')).toBe(6)
    setNow(result.reservation.expiresAt)

    expect(coordinator.expireDueReservations()).toHaveLength(1)
    expect(coordinator.getAvailableStock('limited-phone')).toBe(10)
    expect(coordinator.expireDueReservations()).toEqual([])
    expect(coordinator.expireDueReservations()).toEqual([])
    expect(coordinator.getAvailableStock('limited-phone')).toBe(10)
  })

  it('keeps checkout and expiry consistent when either transition runs first near the deadline', () => {
    const checkoutFirst = createInventory(2, 100)
    const checkoutReservation = checkoutFirst.coordinator.reserve('limited-phone')
    if (!checkoutReservation.ok) throw new Error('test setup could not reserve stock')

    checkoutFirst.setNow(checkoutReservation.reservation.expiresAt - 1)
    expect(checkoutFirst.coordinator.checkout(checkoutReservation.reservation.id).ok).toBe(true)
    checkoutFirst.setNow(checkoutReservation.reservation.expiresAt)
    expect(checkoutFirst.coordinator.expireDueReservations()).toEqual([])
    expect(checkoutFirst.coordinator.getAvailableStock('limited-phone')).toBe(1)
    expect(checkoutFirst.coordinator.getReservation(checkoutReservation.reservation.id)?.status)
      .toBe('checked-out')

    const expiryFirst = createInventory(2, 100)
    const expiryReservation = expiryFirst.coordinator.reserve('limited-phone')
    if (!expiryReservation.ok) throw new Error('test setup could not reserve stock')

    expiryFirst.setNow(expiryReservation.reservation.expiresAt)
    expect(expiryFirst.coordinator.expireDueReservations()).toHaveLength(1)
    expect(expiryFirst.coordinator.checkout(expiryReservation.reservation.id)).toEqual({
      ok: false,
      reason: 'reservation-expired',
    })
    expect(expiryFirst.coordinator.getAvailableStock('limited-phone')).toBe(2)
    expect(expiryFirst.coordinator.expireDueReservations()).toEqual([])
    expect(expiryFirst.coordinator.getAvailableStock('limited-phone')).toBe(2)
  })

  it('recalculates the countdown from the wall clock after a delayed animation frame', () => {
    const fake = createFrameScheduler(20_000)
    const ticks: number[] = []
    const onComplete = vi.fn()

    startCountdown(1_200, (remaining) => ticks.push(remaining), onComplete, fake.scheduler)

    expect(ticks).toEqual([1_200])
    expect(fake.pendingCount()).toBe(1)
    fake.setNow(20_875)
    fake.nextFrame()
    expect(ticks).toEqual([1_200, 325])

    fake.setNow(21_300)
    fake.nextFrame()
    expect(ticks).toEqual([1_200, 325, 0])
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(fake.pendingCount()).toBe(0)
  })

  it('cancels the pending animation frame when the countdown is stopped', () => {
    const fake = createFrameScheduler(3_000)
    const ticks: number[] = []
    const onComplete = vi.fn()
    const stop = startCountdown(900, (remaining) => ticks.push(remaining), onComplete, fake.scheduler)
    const pendingFrame = fake.pendingEntry()

    expect(pendingFrame).toBeDefined()
    stop()

    expect(fake.cancelled).toEqual([pendingFrame?.[0]])
    expect(fake.pendingCount()).toBe(0)
    pendingFrame?.[1](3_500)
    expect(ticks).toEqual([900])
    expect(onComplete).not.toHaveBeenCalled()
  })
})
