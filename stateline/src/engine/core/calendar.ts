/**
 * Deterministic game calendar.
 *
 * Time is an integer `DayIndex` = days since 1970-01-01 (proleptic Gregorian). We deliberately do NOT
 * use the JS `Date` object: it carries timezone/locale behaviour that would make the simulation
 * non-reproducible across machines. All conversions use Howard Hinnant's well-known civil<->days
 * algorithm, which is exact for any year.
 *
 * A `tick` is the engine's unit of advancement. `daysPerTick` lets a campaign run a week per turn while
 * a governing session might run a day per turn — without any other system caring about the difference.
 */

export type DayIndex = number

export interface CalendarDate {
  /** Full year, e.g. 2026. */
  readonly year: number
  /** 1–12. */
  readonly month: number
  /** 1–31. */
  readonly day: number
}

export interface Calendar {
  /** Absolute current day. */
  readonly dayIndex: DayIndex
  /** Day the game started (for "days elapsed" style queries). */
  readonly startDayIndex: DayIndex
  /** Number of elapsed ticks since game start. */
  readonly tickCount: number
  /** Days advanced per tick (campaign default 7, governing default 1). */
  readonly daysPerTick: number
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new RangeError(`month out of range: ${month}`)
  if (month === 2 && isLeapYear(year)) return 29
  return MONTH_DAYS[month - 1] as number
}

/** Days since 1970-01-01 for a civil date. Proleptic Gregorian; valid for negative years too. */
export function dateToDayIndex({ year, month, day }: CalendarDate): DayIndex {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor((y >= 0 ? y : y - 399) / 400)
  const yoe = y - era * 400 // [0, 399]
  const mp = month + (month > 2 ? -3 : 9) // Mar=0 ... Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1 // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy // [0, 146096]
  return era * 146097 + doe - 719468
}

/** Inverse of {@link dateToDayIndex}. */
export function dayIndexToDate(dayIndex: DayIndex): CalendarDate {
  const z = dayIndex + 719468
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097)
  const doe = z - era * 146097 // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  ) // [0, 399]
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)) // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153) // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1 // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9 // [1, 12]
  return { year: y + (month <= 2 ? 1 : 0), month, day }
}

/** Day of week, 0 = Sunday … 6 = Saturday. (1970-01-01 was a Thursday.) */
export function weekday(dayIndex: DayIndex): number {
  return ((((dayIndex + 4) % 7) + 7) % 7) as number
}

export function addDays(dayIndex: DayIndex, days: number): DayIndex {
  return dayIndex + days
}

/** ISO `YYYY-MM-DD` for display. */
export function formatDate(dayIndex: DayIndex): string {
  const { year, month, day } = dayIndexToDate(dayIndex)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

/**
 * US federal Election Day: the first Tuesday AFTER the first Monday in November.
 * (Not simply "first Tuesday" — when Nov 1 is a Tuesday, election day is Nov 8.)
 */
export function generalElectionDay(year: number): DayIndex {
  let d = dateToDayIndex({ year, month: 11, day: 1 })
  while (weekday(d) !== 1) d++ // advance to the first Monday (1)
  return d + 1 // the Tuesday after it
}

export function createCalendar(start: CalendarDate, daysPerTick = 7): Calendar {
  const startDayIndex = dateToDayIndex(start)
  return { dayIndex: startDayIndex, startDayIndex, tickCount: 0, daysPerTick }
}

/** Advance the calendar by `ticks` ticks. Pure. */
export function advanceCalendar(cal: Calendar, ticks = 1): Calendar {
  return {
    ...cal,
    dayIndex: cal.dayIndex + ticks * cal.daysPerTick,
    tickCount: cal.tickCount + ticks,
  }
}

export function daysElapsed(cal: Calendar): number {
  return cal.dayIndex - cal.startDayIndex
}
