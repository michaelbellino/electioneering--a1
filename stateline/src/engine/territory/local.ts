/**
 * Local decomposition: what the race looks like community by community. Pure functions over
 * GameState — the same voter model evaluated on each community's own demographic mix and lean,
 * with ground presence shifting local awareness. Used for the trail map, canvass intel, and the
 * election-night map.
 */
import { clamp, clamp01 } from '../core/primitives'
import { evaluateElectorate } from '../electorate/evaluate'
import type { CandidateProfile, ElectorateState, VoterGroup } from '../electorate/types'
import type { Community, TerritoryState } from './generate'

/** How strongly ground presence moves local awareness (the door-knocked town knows you). */
const PRESENCE_AWARENESS = 0.5

/** Build the community's own electorate: district groups reweighted to the local mix + local lean. */
export function communityElectorate(
  electorate: ElectorateState,
  community: Community,
): ElectorateState {
  const groups: VoterGroup[] = electorate.groups.map((g) => {
    const localShare = community.segmentShares[g.id] ?? g.weight
    return {
      ...g,
      weight: localShare,
      cvap: electorate.cvap * community.weight * localShare,
      partisanLean: clamp(g.partisanLean + community.leanOffset, -1, 1),
    }
  })
  return {
    ...electorate,
    cvap: electorate.cvap * community.weight,
    groups,
  }
}

/** Candidate profiles as this community perceives them (presence lifts local awareness). */
export function localProfiles(
  profiles: readonly CandidateProfile[],
  playerId: string,
  community: Community,
  territory: TerritoryState,
): CandidateProfile[] {
  const own = territory.presence[community.id] ?? 0
  const opp = territory.oppPresence[community.id] ?? 0
  return profiles.map((p) => {
    const presence = p.candidateId === playerId ? own : opp
    return { ...p, awareness: clamp01(p.awareness * (0.85 + PRESENCE_AWARENESS * presence)) }
  })
}

export interface CommunityStanding {
  readonly communityId: string
  /** Player's local two-way support share. */
  readonly playerShare: number
  /** Local expected votes (turnout-weighted). */
  readonly votes: number
}

/** The full local decomposition — every community's current standing (the omniscient view). */
export function communityStandings(
  electorate: ElectorateState,
  profiles: readonly CandidateProfile[],
  playerId: string,
  territory: TerritoryState,
): CommunityStanding[] {
  return territory.communities.map((c) => {
    const local = evaluateElectorate(communityElectorate(electorate, c), localProfiles(profiles, playerId, c, territory))
    return {
      communityId: c.id,
      playerShare: local.sharesByCandidate[playerId] ?? 0,
      votes: local.totalVotes,
    }
  })
}
