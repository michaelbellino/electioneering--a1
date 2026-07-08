/**
 * Hireable staff pool — the tycoon layer. Staff amplify matching campaign actions (the engine's
 * `amplifiedBy` hook), the manager runs a tighter week (+1 AP), and the pollster buys you better
 * data (bigger poll samples → smaller margin of error). Pure data; hiring/firing are reducer actions.
 */
import type { Cents } from '../../engine/core/primitives'
import type { StaffRole } from '../../engine/campaign/types'

export interface HireableStaffDef {
  readonly id: string
  readonly name: string
  readonly role: StaffRole
  readonly blurb: string
  /** One-time signing cost. */
  readonly signingBonus: Cents
  readonly weeklySalary: Cents
  /** Effectiveness 0..1 (see engine `staffEffectiveness`). */
  readonly effectiveness: number
}

const USD = (d: number): Cents => Math.round(d * 100)

export const STAFF_POOL: readonly HireableStaffDef[] = [
  {
    id: 'staff_manager',
    name: 'Campaign Manager',
    role: 'manager',
    blurb: 'Runs the calendar so you don’t have to. +1 action point every week.',
    signingBonus: USD(5000),
    weeklySalary: USD(2500),
    effectiveness: 0.8,
  },
  {
    id: 'staff_comms',
    name: 'Comms Director',
    role: 'comms_director',
    blurb: 'Sharper scripts, better bookings. Amplifies ads and speeches.',
    signingBonus: USD(3000),
    weeklySalary: USD(2000),
    effectiveness: 0.7,
  },
  {
    id: 'staff_field',
    name: 'Field Director',
    role: 'field_director',
    blurb: 'Clipboards and door-knocks. Amplifies rallies and the ground game.',
    signingBonus: USD(3000),
    weeklySalary: USD(1800),
    effectiveness: 0.7,
  },
  {
    id: 'staff_fundraiser',
    name: 'Finance Director',
    role: 'fundraiser',
    blurb: 'Knows every check-writer in the state. Boosts all fundraising.',
    signingBonus: USD(4000),
    weeklySalary: USD(2200),
    effectiveness: 0.75,
  },
  {
    id: 'staff_pollster',
    name: 'Pollster',
    role: 'pollster',
    blurb: 'Bigger samples, tighter numbers. Cuts your polling margin of error.',
    signingBonus: USD(2500),
    weeklySalary: USD(1500),
    effectiveness: 0.8,
  },
] as const

export function getHireableStaff(id: string): HireableStaffDef | undefined {
  return STAFF_POOL.find((s) => s.id === id)
}

/** Field-office tycoon knob: each office costs more than the last and adds +5% to all action effects. */
export const OFFICE_BASE_COST: Cents = USD(6000)
export const OFFICE_COST_GROWTH = 1.6
export const MAX_OFFICES = 5

export function officeCost(officesOwned: number): Cents {
  return Math.round(OFFICE_BASE_COST * Math.pow(OFFICE_COST_GROWTH, officesOwned))
}
