/**
 * The active demographics snapshot the game loads at runtime.
 *
 * Today this points at the provisional SEED. After running the Census ETL
 * (`CENSUS_API_KEY=… npm run etl:demographics`), switch this to import the generated JSON:
 *
 *     import generated from './demographics.generated.json'
 *     export const ACTIVE_DEMOGRAPHICS = generated as DemographicsDataset
 *
 * Keeping the switch explicit (rather than auto-detecting a file) means the data version a build ships
 * with is always visible in source control.
 */
import type { DemographicsDataset } from '../schema'
import { DEMOGRAPHICS_SEED } from './demographics.seed'

export const ACTIVE_DEMOGRAPHICS: DemographicsDataset = DEMOGRAPHICS_SEED
