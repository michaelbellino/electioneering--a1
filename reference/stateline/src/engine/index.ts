/**
 * Public engine API. The UI talks ONLY to this surface: create a game from a scenario, dispatch
 * serializable actions, advance turns, read the immutable state, subscribe to changes, and
 * serialize/deserialize for save/load. The engine never imports the UI.
 */
import { applyAction, currentProfiles, tick, type GameAction } from './reducer'
import { createGame, type Scenario } from './scenario'
import type { GameState } from './state'

export type EngineListener = (state: GameState) => void

export class Engine {
  private state: GameState
  private readonly listeners = new Set<EngineListener>()

  private constructor(state: GameState) {
    this.state = state
  }

  static create(scenario: Scenario, seed: number): Engine {
    return new Engine(createGame(scenario, seed))
  }

  static deserialize(json: string): Engine {
    return new Engine(JSON.parse(json) as GameState)
  }

  getState(): GameState {
    return this.state
  }

  dispatch(action: GameAction): GameState {
    this.state = applyAction(this.state, action)
    this.emit()
    return this.state
  }

  /** Advance one turn (a week). */
  advanceTurn(): GameState {
    this.state = tick(this.state)
    this.emit()
    return this.state
  }

  profiles() {
    return currentProfiles(this.state)
  }

  serialize(): string {
    return JSON.stringify(this.state)
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const l of this.listeners) l(this.state)
  }
}

export { createGame } from './scenario'
export type { Scenario, ScenarioCandidate } from './scenario'
export { applyAction, tick, currentProfiles } from './reducer'
export type { GameAction } from './reducer'
export type { GameState, SliceElection, PollRecord } from './state'
export { ENGINE_VERSION } from './state'
