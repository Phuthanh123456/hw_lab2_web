/**
 * Builds an absolute deadline from a duration and a clock reading.
 * Keeping nowMs injectable makes this calculation deterministic in tests.
 */
export function getTargetTimeMs(durationMs: number, nowMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError('durationMs must be a finite non-negative number')
  }

  if (!Number.isFinite(nowMs)) {
    throw new RangeError('nowMs must be a finite number')
  }

  const targetTimeMs = nowMs + durationMs
  if (!Number.isFinite(targetTimeMs)) {
    throw new RangeError('target time must be a finite number')
  }

  return targetTimeMs
}

/**
 * Returns time remaining from an absolute deadline; it never accumulates frame deltas.
 */
export function getRemainingMs(targetTimeMs: number, nowMs: number): number {
  if (!Number.isFinite(targetTimeMs)) {
    throw new RangeError('targetTimeMs must be a finite number')
  }

  if (!Number.isFinite(nowMs)) {
    throw new RangeError('nowMs must be a finite number')
  }

  return Math.max(0, targetTimeMs - nowMs)
}
