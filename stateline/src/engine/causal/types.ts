/**
 * Causal-graph types — the engine's own explanation of "what moves votes, and through what."
 *
 * The graph is DERIVED, never authored: nodes come from live content data (actions, issues, segments)
 * and `GameState`; edge weights are measured sensitivities of the pure electorate model (perturb an
 * input, re-evaluate, read the vote-share delta). That keeps the graph honest — it can never drift
 * from the simulation, because it *is* the simulation, differentiated.
 *
 * Structure (a DAG, five layers):
 *   action → lever → outcome ← segment ← issue
 * "Levers" are the campaign channels a player actually moves: awareness, favorability (own and
 * opponent's), ground game, and the war chest.
 */

export type CausalNodeKind = 'action' | 'lever' | 'outcome' | 'segment' | 'issue'

export interface CausalNode {
  readonly id: string
  readonly kind: CausalNodeKind
  readonly label: string
  /** Primary live value; semantics depend on kind (share, level, position…). */
  readonly value: number
  /** The value, formatted for display ("58.2%", "+0.4 pts/0.1", "$23,600"). */
  readonly valueLabel: string
  /** One-sentence plain-language explanation of the node. */
  readonly detail: string
}

export type CausalEdgeKind =
  /** Action → lever: effect magnitude straight from the action's content data. */
  | 'action_effect'
  /** Lever → outcome: measured ∂(player share)/∂(lever), in share points per step. */
  | 'lever_sensitivity'
  /** Issue → segment: measured ∂(in-group support)/∂(player position), pts per +0.1 progressive. */
  | 'issue_position'
  /** Segment → outcome: the group's share of expected votes, signed by who it currently favors. */
  | 'segment_votes'

export interface CausalEdge {
  readonly source: string
  readonly target: string
  readonly kind: CausalEdgeKind
  /**
   * Signed strength. Sign convention: positive = pushes the PLAYER's vote share up
   * (or, for action_effect edges, pushes the lever up). Units depend on kind — see labels.
   */
  readonly weight: number
  /** Human reading of the weight ("+1.2 pts per +0.1 favorability"). */
  readonly label: string
}

export interface CausalGraph {
  readonly nodes: readonly CausalNode[]
  readonly edges: readonly CausalEdge[]
}
