import { useGame } from '@ui/store/gameStore'
import { getDilemma } from '@data/campaign/dilemmas'
import type { GameState } from '@engine/index'
import { fmtUsd } from '@ui/format'
import type { DilemmaOption } from '@engine/campaign/dilemmas'

function optionHints(o: DilemmaOption): string[] {
  const hints: string[] = []
  const c = o.consequence
  if (c.cashDelta) hints.push(`${c.cashDelta > 0 ? '+' : '−'}${fmtUsd(Math.abs(c.cashDelta)).slice(0)}`)
  if (c.apDelta) hints.push(`${c.apDelta > 0 ? '+' : ''}${c.apDelta} AP`)
  if (c.positionShifts?.length) hints.push('shifts your platform')
  if (c.scandal?.target === 'opponent') hints.push('hits their scandal meter')
  if (c.scandal?.target === 'self') hints.push('some mud sticks to you')
  if (o.risk) hints.push(`risk${o.risk.mitigatedBy ? ` (${o.risk.mitigatedBy} helps)` : ''}`)
  return hints
}

export function DilemmaModal({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  if (!state.pendingDilemma) return null
  const def = getDilemma(state.pendingDilemma.defId)
  if (!def) return null

  return (
    <div className="dilemma-backdrop" role="dialog" aria-modal="true" aria-labelledby="dilemma-title">
      <div className="dilemma-card">
        <span className="dilemma-kicker">On your desk</span>
        <h2 id="dilemma-title">{def.title}</h2>
        <p className="dilemma-prompt">{def.prompt}</p>
        <div className="dilemma-options">
          {def.options.map((o) => (
            <button
              key={o.id}
              className="dilemma-option"
              onClick={() =>
                dispatch({ type: 'campaign/resolveDilemma', payload: { optionId: o.id } })
              }
            >
              <strong>{o.label}</strong>
              <span>{o.blurb}</span>
              <span className="dilemma-hints">
                {optionHints(o).map((h, i) => (
                  <em key={i}>{h}</em>
                ))}
              </span>
            </button>
          ))}
        </div>
        <p className="dilemma-footnote muted">
          Advance the week without deciding and the story resolves itself — usually the cautious way.
        </p>
      </div>
    </div>
  )
}
