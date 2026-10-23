import { describe, expect, it } from 'vitest'
import { getRemainingMs, getTargetTimeMs } from '../countdown-math'

describe('countdown math', () => {
  it('calculates remaining time from the absolute deadline', () => {
    expect(getRemainingMs(12_500, 2_500)).toBe(10_000)
  })

  it('returns zero exactly at the deadline', () => {
    expect(getRemainingMs(5_000, 5_000)).toBe(0)
  })

  it('clamps an elapsed deadline to zero', () => {
    expect(getRemainingMs(4_000, 4_001)).toBe(0)
  })

  it('builds a deadline from a finite non-negative duration', () => {
    expect(getTargetTimeMs(1_500, 10_000)).toBe(11_500)
    expect(getTargetTimeMs(0, 10_000)).toBe(10_000)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid duration %s',
    (durationMs) => {
      expect(() => getTargetTimeMs(durationMs, 10_000)).toThrow(RangeError)
    },
  )

  it('rejects invalid clock readings and deadlines', () => {
    expect(() => getTargetTimeMs(1, Number.NaN)).toThrow(RangeError)
    expect(() => getTargetTimeMs(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow(RangeError)
    expect(() => getRemainingMs(Number.POSITIVE_INFINITY, 0)).toThrow(RangeError)
    expect(() => getRemainingMs(10, Number.NaN)).toThrow(RangeError)
  })
})
