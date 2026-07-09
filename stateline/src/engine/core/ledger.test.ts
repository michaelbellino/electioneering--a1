import { describe, expect, it } from 'vitest'
import {
  appliedMagnitudeAt,
  isEffectLive,
  sumElectorateChannel,
  type ScheduledEffect,
} from './ledger'

function effect(partial: Partial<ScheduledEffect>): ScheduledEffect {
  return {
    id: 'e1',
    target: {
      kind: 'electorate',
      jurisdictionId: 'j',
      candidateId: 'c',
      channel: 'nameRecognition',
    },
    op: 'add',
    magnitude: 10,
    enactedDay: 0,
    rampStartDays: 0,
    rampDurationDays: 0,
    decayHalfLifeDays: null,
    sunsetDay: null,
    attributionActorId: null,
    sourceSubsystem: 'campaign',
    ...partial,
  }
}

describe('ledger — appliedMagnitudeAt', () => {
  it('is zero before enactment + ramp start', () => {
    const e = effect({ enactedDay: 10, rampStartDays: 2 })
    expect(appliedMagnitudeAt(e, 9)).toBe(0)
    expect(appliedMagnitudeAt(e, 11)).toBe(0) // still before ramp start (10+2)
    expect(appliedMagnitudeAt(e, 12)).toBe(10) // instantaneous ramp
  })

  it('ramps linearly to the plateau', () => {
    const e = effect({ magnitude: 10, rampDurationDays: 4 })
    expect(appliedMagnitudeAt(e, 0)).toBe(0)
    expect(appliedMagnitudeAt(e, 1)).toBeCloseTo(2.5)
    expect(appliedMagnitudeAt(e, 2)).toBeCloseTo(5)
    expect(appliedMagnitudeAt(e, 4)).toBeCloseTo(10)
    expect(appliedMagnitudeAt(e, 8)).toBeCloseTo(10) // plateau holds with no decay
  })

  it('decays exponentially after the plateau', () => {
    const e = effect({ magnitude: 10, rampDurationDays: 4, decayHalfLifeDays: 10 })
    expect(appliedMagnitudeAt(e, 4)).toBeCloseTo(10) // plateau reached
    expect(appliedMagnitudeAt(e, 14)).toBeCloseTo(5) // one half-life later
    expect(appliedMagnitudeAt(e, 24)).toBeCloseTo(2.5) // two half-lives
  })

  it('honours a hard sunset', () => {
    const e = effect({ magnitude: 10, sunsetDay: 20 })
    expect(appliedMagnitudeAt(e, 19)).toBe(10)
    expect(appliedMagnitudeAt(e, 20)).toBe(0)
  })

  it('reproduces the canonical ramp-then-decay fixture', () => {
    const e = effect({ magnitude: 10, rampDurationDays: 4, decayHalfLifeDays: 10 })
    const series = [0, 1, 2, 3, 4, 14].map((d) => Number(appliedMagnitudeAt(e, d).toFixed(2)))
    expect(series).toEqual([0, 2.5, 5, 7.5, 10, 5])
  })
})

describe('ledger — liveness & pruning', () => {
  it('marks fully-decayed effects dead', () => {
    const e = effect({ magnitude: 10, decayHalfLifeDays: 5 })
    expect(isEffectLive(e, 10)).toBe(true)
    expect(isEffectLive(e, 5 * 8 + 1)).toBe(false)
  })
})

describe('ledger — channel summation', () => {
  it('sums only matching electorate channel effects', () => {
    const ledger: ScheduledEffect[] = [
      effect({ id: 'a', magnitude: 5 }), // default target = j/c/nameRecognition
      effect({
        id: 'b',
        magnitude: 7,
        target: { kind: 'electorate', jurisdictionId: 'j', candidateId: 'c', channel: 'nameRecognition' },
      }),
      effect({
        id: 'c2',
        magnitude: 100,
        target: { kind: 'electorate', jurisdictionId: 'OTHER', candidateId: 'c', channel: 'nameRecognition' },
      }),
      effect({
        id: 'd',
        magnitude: 100,
        target: { kind: 'electorate', jurisdictionId: 'j', candidateId: 'c', channel: 'favorability' },
      }),
    ]
    const total = sumElectorateChannel(ledger, 100, {
      jurisdictionId: 'j',
      candidateId: 'c',
      channel: 'nameRecognition',
    })
    // 'a' (default target j/c/nameRecognition, mag 5) + 'b' (mag 7) = 12; others excluded.
    expect(total).toBe(12)
  })
})
