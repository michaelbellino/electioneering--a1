import { describe, expect, it } from 'vitest'
import {
  advanceCalendar,
  createCalendar,
  dateToDayIndex,
  dayIndexToDate,
  daysInMonth,
  formatDate,
  generalElectionDay,
  isLeapYear,
  weekday,
} from './calendar'

describe('calendar — leap years & month lengths', () => {
  it('identifies leap years correctly', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    expect(isLeapYear(2000)).toBe(true) // divisible by 400
    expect(isLeapYear(1900)).toBe(false) // divisible by 100 but not 400
  })

  it('returns correct days in month including February', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2024, 1)).toBe(31)
    expect(daysInMonth(2024, 4)).toBe(30)
  })
})

describe('calendar — date <-> dayIndex round trip', () => {
  it('round-trips a sweep of dates', () => {
    // Sweep one day at a time across a multi-year span (incl. leap years) and check inverse.
    const start = dateToDayIndex({ year: 2020, month: 1, day: 1 })
    const end = dateToDayIndex({ year: 2030, month: 12, day: 31 })
    for (let idx = start; idx <= end; idx++) {
      const date = dayIndexToDate(idx)
      expect(dateToDayIndex(date)).toBe(idx)
    }
  })

  it('anchors the unix epoch', () => {
    expect(dateToDayIndex({ year: 1970, month: 1, day: 1 })).toBe(0)
  })

  it('knows real weekdays (1970-01-01 = Thursday)', () => {
    expect(weekday(dateToDayIndex({ year: 1970, month: 1, day: 1 }))).toBe(4) // Thu
    expect(weekday(dateToDayIndex({ year: 2024, month: 11, day: 5 }))).toBe(2) // Tue (election day 2024)
    expect(weekday(dateToDayIndex({ year: 2026, month: 6, day: 24 }))).toBe(3) // Wed
  })

  it('formats ISO dates', () => {
    expect(formatDate(dateToDayIndex({ year: 2026, month: 6, day: 24 }))).toBe('2026-06-24')
  })
})

describe('calendar — US general election day', () => {
  it('is the first Tuesday after the first Monday of November', () => {
    expect(formatDate(generalElectionDay(2024))).toBe('2024-11-05')
    expect(formatDate(generalElectionDay(2026))).toBe('2026-11-03')
    expect(formatDate(generalElectionDay(2028))).toBe('2028-11-07')
    // 2026: Nov 3 is election day, Nov 2 (the first Monday) is NOT.
    expect(generalElectionDay(2026)).toBe(dateToDayIndex({ year: 2026, month: 11, day: 3 }))
    expect(generalElectionDay(2026)).not.toBe(dateToDayIndex({ year: 2026, month: 11, day: 2 }))
  })
})

describe('calendar — advancement', () => {
  it('advances by daysPerTick and counts ticks', () => {
    const cal = createCalendar({ year: 2026, month: 1, day: 1 }, 7)
    const after3 = advanceCalendar(cal, 3)
    expect(after3.tickCount).toBe(3)
    expect(after3.dayIndex - cal.dayIndex).toBe(21)
    expect(formatDate(after3.dayIndex)).toBe('2026-01-22')
  })

  it('advancing N ticks at once equals N single advances', () => {
    const cal = createCalendar({ year: 2026, month: 1, day: 1 }, 7)
    let step = cal
    for (let i = 0; i < 10; i++) step = advanceCalendar(step, 1)
    const bulk = advanceCalendar(cal, 10)
    expect(step).toEqual(bulk)
  })

  it('is pure — does not mutate input', () => {
    const cal = createCalendar({ year: 2026, month: 1, day: 1 }, 7)
    const snapshot = { ...cal }
    advanceCalendar(cal, 5)
    expect(cal).toEqual(snapshot)
  })
})
