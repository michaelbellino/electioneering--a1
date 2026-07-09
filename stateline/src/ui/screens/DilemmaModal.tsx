import { useState } from 'react'
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

interface Outcome {
  title: string
  text: string
  failed: boolean
  deltas: string[]
}

export function DilemmaModal({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const pendingDef = state.pendingDilemma ? getDilemma(state.pendingDilemma.defId) : null

  // Outcome card: shown after deciding, until dismissed.
  if (outcome) {
    return (
      <div className="dilemma-backdrop" role="dialog" aria-modal="true" aria-labelledby="dilemma-outcome-title">
        <div className={`dilemma-card outcome ${outcome.failed ? 'outcome-bad' : 'outcome-good'}`}>
          <span className="dilemma-kicker">{outcome.failed ? 'It went sideways' : 'How it played'}</span>
          <h2 id="dilemma-outcome-title">{outcome.title}</h2>
          <p className="dilemma-prompt">{outcome.text}</p>
          {outcome.deltas.length > 0 && (
            <div className="dilemma-hints" style={{ marginBottom: '1rem' }}>
              {outcome.deltas.map((d, i) => (
                <em key={i}>{d}</em>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setOutcome(null)}>
            Back to the campaign →
          </button>
        </div>
      </div>
    )
  }

  if (!state.pendingDilemma || !pendingDef) return null
  const def = pendingDef

  const choose = (o: DilemmaOption) => {
    const before = useGame.getState().state!
    dispatch({ type: 'campaign/resolveDilemma', payload: { optionId: o.id } })
    const after = useGame.getState().state!
    // The engine logs the authoritative outcome (including risk rolls) — read it back.
    const line = [...after.log].reverse().find((l) => l.kind === 'dilemma')
    const text = line?.message.replace(`${def.title}: `, '') ?? o.resultText
    const failed = o.risk ? text === o.risk.failText : false

    const deltas: string[] = []
    const dCash = after.campaign.finance.cash - before.campaign.finance.cash
    if (dCash !== 0) deltas.push(`${dCash > 0 ? '+' : '−'}${fmtUsd(Math.abs(dCash))} cash`)
    const dAp = after.campaign.actionPoints - before.campaign.actionPoints
    if (dAp !== 0) deltas.push(`${dAp > 0 ? '+' : ''}${dAp} AP this week`)
    const you = after.playerCandidateId
    const dScandal =
      (after.candidates[you]?.scandalLoad ?? 0) - (before.candidates[you]?.scandalLoad ?? 0)
    if (dScandal > 0.001) deltas.push(`scandal +${Math.round(dScandal * 100)}`)
    const oppId = after.election.candidateIds.find((id) => id !== you)
    const dOppScandal = oppId
      ? (after.candidates[oppId]?.scandalLoad ?? 0) - (before.candidates[oppId]?.scandalLoad ?? 0)
      : 0
    if (dOppScandal > 0.001) deltas.push(`their scandal +${Math.round(dOppScandal * 100)}`)
    if (after.ledger.length > before.ledger.length) deltas.push('opinion effects in motion')
    if (
      JSON.stringify(after.candidates[you]?.positions) !==
      JSON.stringify(before.candidates[you]?.positions)
    )
      deltas.push('your platform moved')

    setOutcome({ title: def.title, text, failed, deltas })
  }

  return (
    <div className="dilemma-backdrop" role="dialog" aria-modal="true" aria-labelledby="dilemma-title">
      <div className="dilemma-card">
        <span className="dilemma-kicker">On your desk</span>
        <h2 id="dilemma-title">{def.title}</h2>
        <p className="dilemma-prompt">{def.prompt}</p>
        <div className="dilemma-options">
          {def.options.map((o) => (
            <button key={o.id} className="dilemma-option" onClick={() => choose(o)}>
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
