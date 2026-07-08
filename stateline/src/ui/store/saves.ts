/**
 * Save-game persistence. Browser builds use localStorage; the Tauri desktop shell swaps this for
 * real files on disk (same interface). The engine serializes byte-identically, so a save is just
 * the JSON GameState plus display metadata.
 */
import type { GameState } from '@engine/index'

export interface SaveSlot {
  readonly id: string
  readonly name: string
  readonly savedAt: number
  readonly scenarioTitle: string
  readonly week: number
  readonly phase: string
  readonly json: string
}

const KEY = 'stateline-saves-v1'
const MAX_SLOTS = 12

export function listSaves(): SaveSlot[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as SaveSlot[]).sort(
      (a, b) => b.savedAt - a.savedAt,
    )
  } catch {
    return []
  }
}

export function saveGame(state: GameState, name?: string): SaveSlot {
  const slot: SaveSlot = {
    id: `save-${Date.now()}-${state.meta.seed}`,
    name: name?.trim() || `${state.election.title} — week ${Math.floor((state.calendar.dayIndex - 0) / 7) % 1000}`,
    savedAt: Date.now(),
    scenarioTitle: state.election.title,
    week: Math.max(1, Math.round((state.calendar.dayIndex - (state.election.electionDay - 200)) / 7)),
    phase: state.phase,
    json: JSON.stringify(state),
  }
  const rest = listSaves().slice(0, MAX_SLOTS - 1)
  localStorage.setItem(KEY, JSON.stringify([slot, ...rest]))
  return slot
}

export function deleteSave(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(listSaves().filter((s) => s.id !== id)))
}

export function loadSave(id: string): GameState | null {
  const slot = listSaves().find((s) => s.id === id)
  if (!slot) return null
  try {
    return JSON.parse(slot.json) as GameState
  } catch {
    return null
  }
}
