/**
 * TERRITORY — the semi-open-world layer. Every run, the district materializes as a seeded map of
 * named communities (urban core, suburbs, towns, rural country), each with its own demographic mix
 * and local lean derived from the real jurisdiction's segments. The candidate is physically
 * somewhere on this map: you travel, you campaign where you stand, and you only truly know the
 * places you've walked. Same seed → same geography; new seed → new district to learn.
 */
import { forkRng, Rng, type RngState } from '../core/rng'
import { clamp, clamp01 } from '../core/primitives'
import type { ElectorateState } from '../electorate/types'
import { VOTER_MODEL } from '../../data/voterModel'

export type CommunityArchetype = 'urban' | 'suburban' | 'town' | 'rural'

export interface Community {
  readonly id: string
  readonly name: string
  readonly archetype: CommunityArchetype
  /** Layout coordinates (grid units with jitter) — also used by the UI map. */
  readonly x: number
  readonly y: number
  /** Share of the jurisdiction's voting population living here (sums to 1). */
  readonly weight: number
  /** Local segment mix (renormalized tilt of the district's real mix). */
  readonly segmentShares: Readonly<Record<string, number>>
  /** Local partisan lean offset vs the district baseline, −1..+1 (small). */
  readonly leanOffset: number
  /** What this place cares about most (hidden info — revealed by canvassing/polling). */
  readonly topIssueId: string
  readonly neighbors: readonly string[]
}

export interface CommunityIntel {
  /** Day the intel was gathered (staleness matters — a week is a lifetime). */
  readonly day: number
  /** Player's estimated support share here at that time. */
  readonly playerShare: number
}

export interface TerritoryState {
  readonly communities: readonly Community[]
  readonly playerLocation: string
  readonly opponentLocation: string
  /** Ground presence per community, 0..1 — built by campaigning there, decays weekly. */
  readonly presence: Readonly<Record<string, number>>
  readonly oppPresence: Readonly<Record<string, number>>
  /** Fog of war: local numbers you've actually gathered (by canvassing there). */
  readonly intel: Readonly<Record<string, CommunityIntel>>
}

const NAME_A = ['North', 'East', 'West', 'South', 'New', 'Old', 'Lake', 'Fort', 'Mount', 'Cedar', 'Maple', 'Iron', 'River', 'Fair', 'Green', 'Stone']
const NAME_B = ['haven', 'field', 'port', 'ridge', 'brook', 'ton', 'ville', 'dale', 'burg', 'mont', 'ford', 'side', 'crest', 'view', 'gate', 'water']

/** Archetype tilts applied to the district's real segment mix (multiplicative, then renormalized). */
const TILT: Record<CommunityArchetype, Record<string, number>> = {
  urban: { white_college: 1.25, white_noncollege: 0.55, black: 1.7, hispanic: 1.5, asian: 1.5, other: 1.1 },
  suburban: { white_college: 1.45, white_noncollege: 0.9, black: 0.85, hispanic: 0.85, asian: 1.2, other: 1 },
  town: { white_college: 0.85, white_noncollege: 1.25, black: 0.85, hispanic: 0.95, asian: 0.6, other: 1 },
  rural: { white_college: 0.55, white_noncollege: 1.6, black: 0.6, hispanic: 0.8, asian: 0.35, other: 1.05 },
}

/** Population weight tendency by archetype (urban cores are dense). */
const DENSITY: Record<CommunityArchetype, number> = { urban: 3.2, suburban: 1.8, town: 1.0, rural: 0.6 }

export interface NamedRegion {
  readonly name: string
  readonly archetype: CommunityArchetype
  readonly weightHint: number
}

export function generateTerritory(
  electorate: ElectorateState,
  seedRng: RngState,
  count: number,
  regions?: readonly NamedRegion[],
): TerritoryState {
  const rng = new Rng(forkRng(seedRng, 'territory'))
  const cols = Math.ceil(Math.sqrt(count * 1.4))
  const rows = Math.ceil(count / cols)

  // Pick an urban core cell; archetype = f(distance from core), with jitter.
  const coreCol = rng.int(0, cols - 1)
  const coreRow = rng.int(0, rows - 1)
  const maxDist = Math.max(1, Math.hypot(Math.max(coreCol, cols - 1 - coreCol), Math.max(coreRow, rows - 1 - coreRow)))

  const cells: Array<{ col: number; row: number }> = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ col: c, row: r })
  // Drop the farthest extra cells deterministically so exactly `count` communities exist.
  cells.sort(
    (a, b) =>
      Math.hypot(a.col - coreCol, a.row - coreRow) - Math.hypot(b.col - coreCol, b.row - coreRow),
  )
  const used = cells.slice(0, count)

  const usedNames = new Set<string>()
  const districtShares = Object.fromEntries(
    electorate.groups.map((g) => [g.id, g.weight]),
  ) as Record<string, number>

  // With named regions (statewide races): heaviest regions claim the central cells; density and
  // archetypes come from real geography instead of the synthetic gradient.
  const sortedRegions = regions ? [...regions].sort((a, b) => b.weightHint - a.weightHint) : null

  const communities: Array<Community & { col: number; row: number }> = used.map((cell, i) => {
    const region = sortedRegions?.[i]
    const dist = Math.hypot(cell.col - coreCol, cell.row - coreRow) / maxDist
    const roll = clamp01(dist + rng.range(-0.12, 0.12))
    const archetype: CommunityArchetype =
      region?.archetype ??
      (roll < 0.18 ? 'urban' : roll < 0.5 ? 'suburban' : roll < 0.78 ? 'town' : 'rural')

    let name = region?.name ?? ''
    if (!name) {
      do {
        name = `${NAME_A[rng.int(0, NAME_A.length - 1)]}${NAME_B[rng.int(0, NAME_B.length - 1)]}`
      } while (usedNames.has(name))
    }
    usedNames.add(name)

    // Tilt the real district mix by archetype and renormalize.
    const tilt = TILT[archetype]
    const raw = Object.fromEntries(
      Object.entries(districtShares).map(([id, w]) => [id, w * (tilt[id] ?? 1) * rng.range(0.85, 1.15)]),
    )
    const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1
    const segmentShares = Object.fromEntries(Object.entries(raw).map(([id, w]) => [id, w / total]))

    // Local lean offset emerges from the mix shift (college/nonwhite → bluer) plus noise.
    const bluish =
      (segmentShares['white_college'] ?? 0) - (districtShares['white_college'] ?? 0) +
      ((segmentShares['black'] ?? 0) - (districtShares['black'] ?? 0)) * 1.5 +
      ((segmentShares['hispanic'] ?? 0) - (districtShares['hispanic'] ?? 0)) -
      ((segmentShares['white_noncollege'] ?? 0) - (districtShares['white_noncollege'] ?? 0))
    const leanOffset = clamp(bluish * 0.6 + rng.range(-0.05, 0.05), -0.35, 0.35)

    // Local priorities: salience-weight the issues by this community's segment mix.
    const salienceByIssue: Record<string, number> = {}
    for (const issue of VOTER_MODEL.issues) {
      let w = 0
      for (const b of VOTER_MODEL.behavior) {
        const segShare = segmentShares[b.segmentId] ?? 0
        w += segShare * (b.issueSalience[issue.id] ?? 1) * issue.baseSalience
      }
      salienceByIssue[issue.id] = w
    }
    const topIssueId = Object.entries(salienceByIssue).sort((a, b) => b[1] - a[1])[0]![0]

    return {
      id: `c${i}`,
      name,
      archetype,
      topIssueId,
      col: cell.col,
      row: cell.row,
      x: cell.col + rng.range(-0.18, 0.18),
      y: cell.row + rng.range(-0.18, 0.18),
      weight: region ? region.weightHint * rng.range(0.95, 1.05) : DENSITY[archetype] * rng.range(0.8, 1.25),
      segmentShares,
      leanOffset,
      neighbors: [],
    }
  })

  // Normalize weights; adjacency = grid neighbors (8-way within distance √2).
  const totalW = communities.reduce((a, c) => a + c.weight, 0)
  const withNeighbors: Community[] = communities.map((c) => ({
    id: c.id,
    name: c.name,
    archetype: c.archetype,
    topIssueId: c.topIssueId,
    x: c.x,
    y: c.y,
    weight: c.weight / totalW,
    segmentShares: c.segmentShares,
    leanOffset: c.leanOffset,
    neighbors: communities
      .filter((o) => o.id !== c.id && Math.hypot(o.col - c.col, o.row - c.row) <= 1.5)
      .map((o) => o.id),
  }))

  // Both candidates start in the biggest community (the media market).
  const start = [...withNeighbors].sort((a, b) => b.weight - a.weight)[0]!.id

  return {
    communities: withNeighbors,
    playerLocation: start,
    opponentLocation: start,
    presence: {},
    oppPresence: {},
    intel: {},
  }
}

export function getCommunity(territory: TerritoryState, id: string): Community | undefined {
  return territory.communities.find((c) => c.id === id)
}

export function areAdjacent(territory: TerritoryState, a: string, b: string): boolean {
  return getCommunity(territory, a)?.neighbors.includes(b) ?? false
}
