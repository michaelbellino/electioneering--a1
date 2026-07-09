/**
 * Runtime loader + validator for baked datasets. The simulation calls this once at game setup; it
 * fails loudly if a snapshot is malformed or references a segment the voter model does not define.
 */
import {
  DemographicsDatasetSchema,
  segmentSharesSumOk,
  type DemographicsDataset,
  type JurisdictionDemographics,
  type VoterModel,
} from './schema'
import { ACTIVE_DEMOGRAPHICS } from './datasets/active'
import { VOTER_MODEL } from './voterModel'

export interface LoadedContent {
  readonly voterModel: VoterModel
  readonly demographics: DemographicsDataset
}

export function loadVoterModel(): VoterModel {
  return VOTER_MODEL // already schema-parsed at module init
}

export function loadDemographics(raw: unknown = ACTIVE_DEMOGRAPHICS): DemographicsDataset {
  const dataset = DemographicsDatasetSchema.parse(raw)
  const validSegmentIds = new Set(VOTER_MODEL.segments.map((s) => s.id))
  for (const j of dataset.jurisdictions) {
    if (!segmentSharesSumOk(j)) {
      const total = Object.values(j.segmentShares).reduce((a, b) => a + b, 0)
      throw new Error(`Jurisdiction ${j.id}: segment shares sum to ${total.toFixed(3)}, expected ~1`)
    }
    for (const segId of Object.keys(j.segmentShares)) {
      if (!validSegmentIds.has(segId)) {
        throw new Error(`Jurisdiction ${j.id}: unknown segment '${segId}' (not in voter model)`)
      }
    }
  }
  return dataset
}

export function loadContent(rawDemographics?: unknown): LoadedContent {
  return {
    voterModel: loadVoterModel(),
    demographics: loadDemographics(rawDemographics),
  }
}

export function getJurisdiction(
  dataset: DemographicsDataset,
  id: string,
): JurisdictionDemographics {
  const j = dataset.jurisdictions.find((x) => x.id === id)
  if (!j) throw new Error(`Unknown jurisdiction: ${id}`)
  return j
}
