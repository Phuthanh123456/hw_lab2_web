import { getRemainingMs, getTargetTimeMs } from './countdown-math'

export interface CountdownFrameScheduler {
  now: () => number
  requestAnimationFrame: (callback: FrameRequestCallback) => number
  cancelAnimationFrame: (frameId: number) => void
}

const browserFrameScheduler: CountdownFrameScheduler = {
  now: () => Date.now(),
  requestAnimationFrame: (callback) => globalThis.requestAnimationFrame(callback),
  cancelAnimationFrame: (frameId) => globalThis.cancelAnimationFrame(frameId),
}

/**
 * Starts an anti-drift countdown. The deadline is captured once; each update
 * derives remaining time from that deadline and the injected wall clock.
 */
export function startCountdown(
  durationMs: number,
  onTick: (remainingMs: number) => void,
  onComplete?: () => void,
  scheduler: CountdownFrameScheduler = browserFrameScheduler,
): () => void {
  const targetTimeMs = getTargetTimeMs(durationMs, scheduler.now())
  let running = true
  let pendingFrameId: number | null = null

  const stop = () => {
    if (!running) return

    running = false
    if (pendingFrameId !== null) {
      scheduler.cancelAnimationFrame(pendingFrameId)
      pendingFrameId = null
    }
  }

  const update = () => {
    pendingFrameId = null
    if (!running) return

    const remainingMs = getRemainingMs(targetTimeMs, scheduler.now())
    if (remainingMs === 0) {
      running = false
      onTick(0)
      onComplete?.()
      return
    }

    onTick(remainingMs)
    if (!running) return

    pendingFrameId = scheduler.requestAnimationFrame(update)
  }

  update()
  return stop
}
