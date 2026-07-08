/**
 * Named regions for statewide Pennsylvania maps. When a race covers the whole state, the trail map
 * should read like Pennsylvania — Philadelphia to Erie — not a generated district. Weights are
 * rough CVAP-share hints (renormalized at generation); archetypes drive the demographic tilts.
 */
import type { CommunityArchetype } from '../../engine/territory/generate'

export interface RegionSeed {
  readonly name: string
  readonly archetype: CommunityArchetype
  /** Relative population weight hint (renormalized). */
  readonly weightHint: number
}

export const PA_REGIONS: readonly RegionSeed[] = [
  { name: 'Philadelphia', archetype: 'urban', weightHint: 12 },
  { name: 'Pittsburgh', archetype: 'urban', weightHint: 6.5 },
  { name: 'Montgomery County', archetype: 'suburban', weightHint: 6.5 },
  { name: 'Bucks County', archetype: 'suburban', weightHint: 5 },
  { name: 'Delaware County', archetype: 'suburban', weightHint: 4.5 },
  { name: 'Chester County', archetype: 'suburban', weightHint: 4.2 },
  { name: 'Allentown–Bethlehem', archetype: 'urban', weightHint: 4.5 },
  { name: 'Allegheny Suburbs', archetype: 'suburban', weightHint: 4.5 },
  { name: 'Harrisburg', archetype: 'town', weightHint: 3.5 },
  { name: 'Lancaster', archetype: 'town', weightHint: 3.8 },
  { name: 'Scranton–Wilkes-Barre', archetype: 'town', weightHint: 3.6 },
  { name: 'York', archetype: 'town', weightHint: 3.2 },
  { name: 'Reading', archetype: 'urban', weightHint: 3 },
  { name: 'Erie', archetype: 'town', weightHint: 2.4 },
  { name: 'Altoona–Johnstown', archetype: 'rural', weightHint: 2.2 },
  { name: 'State College', archetype: 'town', weightHint: 1.6 },
  { name: 'Williamsport & the Tier', archetype: 'rural', weightHint: 1.8 },
  { name: 'The Laurel Highlands', archetype: 'rural', weightHint: 2 },
  { name: 'The Northern Woods', archetype: 'rural', weightHint: 1.6 },
] as const

export const STATE_REGIONS: Readonly<Record<string, readonly RegionSeed[]>> = {
  'us-pa': PA_REGIONS,
}
