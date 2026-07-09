/**
 * The UI's single source of truth: a thin Zustand store wrapping the engine. The store NEVER contains
 * game logic — it forwards player intents to the engine as serializable actions and mirrors the
 * resulting immutable GameState for React to render. (The store/UI layer may use Date.now for a seed;
 * the engine itself never does.)
 */
import { create } from 'zustand'
import { Engine, type GameAction, type GameState } from '@engine/index'
import type { Scenario, ScenarioCandidate } from '@engine/scenario'
import { HOUSE_SPECIAL_PA07 } from '@data/scenarios/houseSpecial'

export type Screen = 'menu' | 'create' | 'campaign' | 'election'

interface GameStore {
  engine: Engine | null
  state: GameState | null
  screen: Screen
  goTo: (screen: Screen) => void
  startGame: (player: Partial<ScenarioCandidate>) => void
  dispatch: (action: GameAction) => void
  advanceTurn: () => void
  reset: () => void
}

export const useGame = create<GameStore>((set, get) => ({
  engine: null,
  state: null,
  screen: 'menu',

  goTo: (screen) => set({ screen }),

  startGame: (player) => {
    const scenario: Scenario = {
      ...HOUSE_SPECIAL_PA07,
      player: { ...HOUSE_SPECIAL_PA07.player, ...player },
    }
    const seed = (Date.now() & 0x7fffffff) || 1
    const engine = Engine.create(scenario, seed)
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

  reset: () => set({ engine: null, state: null, screen: 'menu' }),
}))
