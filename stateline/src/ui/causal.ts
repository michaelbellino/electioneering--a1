/**
 * View-model for the influence map: positions the causal graph as a five-column layered DAG.
 *
 *   Actions → Levers → YOUR VOTE SHARE ← Segments ← Issues
 *
 * Your levers live on the left, the electorate on the right, and everything flows into the outcome
 * at the center. Pure function of GameState → deterministic layout (no force simulation needed).
 */
import { buildCausalGraph } from '@engine/causal/graph'
import type { CausalEdge, CausalNode, CausalNodeKind } from '@engine/causal/types'
import type { GameState } from '@engine/index'

export const NODE_W = 168
export const NODE_H = 44
const COL_GAP = 78
const ROW_GAP = 14
const PAD = 8

const COLUMNS: readonly CausalNodeKind[] = ['action', 'lever', 'outcome', 'segment', 'issue']

export interface VMNode extends CausalNode {
  x: number
  y: number
  col: number
}

export interface VMEdge extends CausalEdge {
  /** Path endpoints: edges always flow toward the center column. */
  x1: number
  y1: number
  x2: number
  y2: number
  /** Stroke width in px, normalized within the edge's kind. */
  stroke: number
}

export interface InfluenceVM {
  nodes: VMNode[]
  edges: VMEdge[]
  width: number
  height: number
}

export function influenceVM(state: GameState): InfluenceVM {
  const graph = buildCausalGraph(state)

  const byCol = COLUMNS.map((kind) => graph.nodes.filter((n) => n.kind === kind))
  const rows = Math.max(...byCol.map((c) => c.length))
  const height = PAD * 2 + rows * NODE_H + (rows - 1) * ROW_GAP
  const width = PAD * 2 + COLUMNS.length * NODE_W + (COLUMNS.length - 1) * COL_GAP

  const nodes: VMNode[] = []
  byCol.forEach((colNodes, ci) => {
    const colHeight = colNodes.length * NODE_H + (colNodes.length - 1) * ROW_GAP
    const top = PAD + (height - PAD * 2 - colHeight) / 2
    colNodes.forEach((n, ri) => {
      nodes.push({ ...n, col: ci, x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP) })
    })
  })
  const pos = new Map(nodes.map((n) => [n.id, n]))

  // Normalize stroke widths within each edge kind so one scale doesn't drown another.
  const maxByKind = new Map<string, number>()
  for (const e of graph.edges) {
    maxByKind.set(e.kind, Math.max(maxByKind.get(e.kind) ?? 0, Math.abs(e.weight)))
  }

  const edges: VMEdge[] = graph.edges.map((e) => {
    const s = pos.get(e.source)!
    const t = pos.get(e.target)!
    // Flow toward the center: left half exits right side of source; right half exits left side.
    const leftward = s.col > t.col
    const x1 = leftward ? s.x : s.x + NODE_W
    const x2 = leftward ? t.x + NODE_W : t.x
    const max = maxByKind.get(e.kind) || 1
    return {
      ...e,
      x1,
      y1: s.y + NODE_H / 2,
      x2,
      y2: t.y + NODE_H / 2,
      stroke: 1.25 + 4 * (Math.abs(e.weight) / max),
    }
  })

  return { nodes, edges, width, height }
}
