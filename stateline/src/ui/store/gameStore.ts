/**
 * The UI's single source of truth: a thin Zustand store wrapping the engine. The store NEVER contains
 * game logic — it forwards player intents to the engine as serializable actions and mirrors the
 * resulting immutable GameState for React to render. (The store/UI layer may use Date.now for a seed;
 * the engine itself never does.)
 */
import { create } from 'zustand'
import { Engine, type GameAction, type GameState, type SandboxOverrides } from '@engine/index'
import type { ScenarioCandidate } from '@engine/scenario'
import { getScenario } from '@data/scenarios/index'
import type { DifficultyId } from '@data/campaign/difficulties'
import { loadSave, saveGame } from '@ui/store/saves'

export type Screen = 'menu' | 'create' | 'campaign' | 'election'

/** Run configuration assembled across the menu + creator screens. */
export interface RunSetup {
  scenarioId: string
  difficultyId: DifficultyId
  /** null = fresh random seed at launch; a number = fixed (sandbox / rematch). */
  seed: number | null
  sandbox: SandboxOverrides | null
  /** Skip the campaign and take office on day one. */
  startInOffice: boolean
}

interface LastRun {
  setup: RunSetup
  seed: number
  player: Partial<ScenarioCandidate>
  traitIds: string[]
}

interface GameStore {
  engine: Engine | null
  state: GameState | null
  screen: Screen
  setup: RunSetup
  lastRun: LastRun | null
  goTo: (screen: Screen) => void
  configure: (patch: Partial<RunSetup>) => void
  startGame: (player: Partial<ScenarioCandidate>, traitIds?: string[]) => void
  /** Restart the exact same run: same scenario, difficulty, candidate, traits, and seed. */
  rematch: () => void
  dispatch: (action: GameAction) => void
  advanceTurn: () => void
  save: (name?: string) => void
  load: (slotId: string) => void
  reset: () => void
}

const DEFAULT_SETUP: RunSetup = {
  scenarioId: 'house-special-pa07',
  difficultyId: 'normal',
  seed: null,
  sandbox: null,
  startInOffice: false,
}

function launch(setup: RunSetup, seed: number, player: Partial<ScenarioCandidate>, traitIds: string[]) {
  const base = getScenario(setup.scenarioId)
  const scenario = { ...base, player: { ...base.player, ...player } }
  return Engine.create(scenario, seed, {
    difficultyId: setup.difficultyId,
    traitIds,
    startInOffice: setup.startInOffice,
    ...(setup.sandbox ? { sandbox: setup.sandbox } : {}),
  })
}

export const useGame = create<GameStore>((set, get) => ({
  engine: null,
  state: null,
  screen: 'menu',
  setup: DEFAULT_SETUP,
  lastRun: null,

  goTo: (screen) => set({ screen }),

  configure: (patch) => set({ setup: { ...get().setup, ...patch } }),

  startGame: (player, traitIds = []) => {
    const setup = get().setup
    const seed = setup.seed ?? ((Date.now() & 0x7fffffff) || 1)
    const engine = launch(setup, seed, player, traitIds)
    set({
      engine,
      state: engine.getState(),
      screen: 'campaign',
      lastRun: { setup, seed, player, traitIds },
    })
  },

  rematch: () => {
    const last = get().lastRun
    if (!last) return
    const engine = launch(last.setup, last.seed, last.player, last.traitIds)
    set({ engine, state: engine.getState(), screen: 'campaign' })
  },

  dispatch: (action) => {
    const engine = get().engine
    if (!engine) return
    set({ state: engine.dispatch(action) })
  },

  advanceTurn: () => {
    const engine = get().engine
    if (!engine) return
    const state = engine.advanceTurn()
    set({ state, screen: state.phase === 'election_night' ? 'election' : get().screen })
  },

  save: (name) => {
    const state = get().state
    if (state) saveGame(state, name)
  },

  load: (slotId) => {
    const state = loadSave(slotId)
    if (!state) return
    const engine = Engine.deserialize(JSON.stringify(state))
    set({
      engine,
      state: engine.getState(),
      screen: engine.getState().phase === 'election_night' ? 'election' : 'campaign',
    })
  },

  reset: () => set({ engine: null, state: null, screen: 'menu', setup: DEFAULT_SETUP }),
}))
