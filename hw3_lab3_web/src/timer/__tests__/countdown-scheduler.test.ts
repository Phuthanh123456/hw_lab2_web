import { describe, expect, it, vi } from 'vitest'
import {
  startCountdown,
  type CountdownFrameScheduler,
} from '../countdown-scheduler'

function createFakeScheduler(initialNowMs = 0) {
  let currentTimeMs = initialNowMs
  let nextFrameId = 1
  const pendingFrames = new Map<number, FrameRequestCallback>()
  const cancelledFrameIds: number[] = []

  const scheduler: CountdownFrameScheduler = {
    now: () => currentTimeMs,
    requestAnimationFrame: (callback) => {
      const frameId = nextFrameId++
      pendingFrames.set(frameId, callback)
      return frameId
    },
    cancelAnimationFrame: (frameId) => {
      cancelledFrameIds.push(frameId)
      pendingFrames.delete(frameId)
    },
  }

  return {
    scheduler,
    setNow: (nowMs: number) => {
      currentTimeMs = nowMs
    },
    pendingCount: () => pendingFrames.size,
    pendingEntry: () => pendingFrames.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined,
    runFrame: () => {
      const entry = pendingFrames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (!entry) throw new Error('No animation frame is pending')
      pendingFrames.delete(entry[0])
      entry[1](currentTimeMs)
    },
    cancelledFrameIds,
  }
}

describe('countdown scheduler', () => {
  it('recalculates from the fixed deadline after a delayed frame', () => {
    const fake = createFakeScheduler(10_000)
    const ticks: number[] = []
    const onComplete = vi.fn()

    startCountdown(1_000, (remaining) => ticks.push(remaining), onComplete, fake.scheduler)

    expect(ticks).toEqual([1_000])
    expect(fake.pendingCount()).toBe(1)

    fake.setNow(10_575)
    fake.runFrame()
    expect(ticks).toEqual([1_000, 425])
    expect(fake.pendingCount()).toBe(1)

    fake.setNow(11_250)
    fake.runFrame()
    expect(ticks).toEqual([1_000, 425, 0])
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(fake.pendingCount()).toBe(0)
  })

  it('reports zero and completes immediately for a zero duration', () => {
    const fake = createFakeScheduler(50)
    const ticks: number[] = []
    const onComplete = vi.fn()

    const stop = startCountdown(0, (remaining) => ticks.push(remaining), onComplete, fake.scheduler)

    expect(ticks).toEqual([0])
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(fake.pendingCount()).toBe(0)
    stop()
    stop()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('cancels the pending frame and ignores a callback delivered after stop', () => {
    const fake = createFakeScheduler(100)
    const ticks: number[] = []
    const onComplete = vi.fn()

    const stop = startCountdown(500, (remaining) => ticks.push(remaining), onComplete, fake.scheduler)
    const pending = fake.pendingEntry()
    expect(pending).toBeDefined()
    expect(fake.pendingCount()).toBe(1)

    stop()
    stop()
    expect(fake.cancelledFrameIds).toEqual([pending?.[0]])
    expect(fake.pendingCount()).toBe(0)

    pending?.[1](200)
    expect(ticks).toEqual([500])
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not schedule another frame when stopped from an update callback', () => {
    const fake = createFakeScheduler(1_000)
    const ticks: number[] = []
    let stop = () => {}

    stop = startCountdown(
      2_000,
      (remaining) => {
        ticks.push(remaining)
        if (ticks.length === 2) stop()
      },
      undefined,
      fake.scheduler,
    )

    fake.setNow(1_100)
    fake.runFrame()

    expect(ticks).toEqual([2_000, 1_900])
    expect(fake.pendingCount()).toBe(0)
  })

  it('rejects an invalid duration before requesting a frame', () => {
    const fake = createFakeScheduler()
    expect(() => startCountdown(Number.NaN, () => {}, undefined, fake.scheduler)).toThrow(
      RangeError,
    )
    expect(fake.pendingCount()).toBe(0)
  })
})
