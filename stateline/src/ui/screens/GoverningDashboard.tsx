import { useGame } from '@ui/store/gameStore'
import type { GameState } from '@engine/index'
import { policySentiment, termVerdict } from '@engine/governing/governing'
import { getPolicy } from '@data/policies'

function ApprovalMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const tone = value >= 0.54 ? 'var(--good)' : value >= 0.46 ? 'var(--gold)' : 'var(--bad)'
  return (
    <div className="stat">
      <span className="stat-label">Approval</span>
      <span className="stat-value" style={{ color: tone }}>
        {pct}%
      </span>
    </div>
  )
}

export function GoverningDashboard({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  const reset = useGame((s) => s.reset)
  const gov = state.governing
  if (!gov) return null

  const ended = state.phase === 'ended'
  const isLeg = gov.office === 'legislator'
  const verdict = termVerdict(gov)

  if (ended) {
    return (
      <div className="election-night">
        <div className={`result-banner ${gov.approval >= 0.5 ? 'win' : 'lose'}`}>
          <span className="result-kicker">{gov.title} · End of term</span>
          <h1>{verdict.grade}</h1>
          <p>Final approval {Math.round(gov.approval * 100)}% · {gov.capital} political capital banked</p>
          <p className="muted" style={{ maxWidth: '36rem', margin: '0.5rem auto 0' }}>{verdict.text}</p>
        </div>
        <div className="panel">
          <h3>Your record</h3>
          <ul className="log">
            {[...gov.record].reverse().slice(0, 14).map((r, i) => (
              <li key={i} className={r.delta >= 0 ? 'log-action' : 'log-action_blocked'}>
                wk {r.week}: {r.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="election-actions">
          <button className="btn btn-primary btn-lg" onClick={reset}>
            New game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dash-bar panel">
        <div className="dash-title">
          <strong>{gov.title}</strong>
          <span className="muted">
            {isLeg ? 'In the chamber' : 'In the governor’s office'} · week {gov.week} of {gov.termWeeks}
          </span>
        </div>
        <div className="dash-stats">
          <ApprovalMeter value={gov.approval} />
          <div className="stat">
            <span className="stat-label">Political capital</span>
            <span className="stat-value">{gov.capital}</span>
          </div>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'gov/advanceWeek', payload: {} })}>
            Next week →
          </button>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-col" style={{ gridColumn: 'span 2' }}>
          <div className="panel">
            <h3>{isLeg ? 'This week’s docket' : 'Your agenda — pick ONE to sign this week'}</h3>
            {gov.docket.length === 0 ? (
              <p className="muted">
                {isLeg
                  ? 'Docket cleared. Advance the week for the next session.'
                  : gov.pendingOutcome
                    ? 'Your order is being implemented — the rollout report lands next week.'
                    : 'Agenda set. Advance the week.'}
              </p>
            ) : (
              <div className="actions">
                {gov.docket.map((b) => {
                  const yea = policySentiment(state, b.policyId, b.direction)
                  const p = getPolicy(b.policyId)
                  return (
                    <div key={b.id} className="action-card bill-card">
                      <div className="action-top">
                        <span className="action-label">{b.title}</span>
                        <span className="action-cost num">{Math.round(yea * 100)}% back it</span>
                      </div>
                      <div className="action-desc">
                        {p ? `${p.label}: ${b.direction > 0 ? p.proLabel : p.conLabel}. District support shown — salience decides how much it matters.` : ''}
                      </div>
                      <div className="bill-actions">
                        {isLeg ? (
                          <>
                            <button className="btn btn-sm" onClick={() => dispatch({ type: 'gov/vote', payload: { billId: b.id, vote: 'yea' } })}>
                              Vote YEA
                            </button>
                            <button className="btn btn-sm" onClick={() => dispatch({ type: 'gov/vote', payload: { billId: b.id, vote: 'nay' } })}>
                              Vote NAY
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-sm"
                            disabled={gov.pendingOutcome !== null}
                            onClick={() => dispatch({ type: 'gov/sign', payload: { billId: b.id } })}
                          >
                            Sign it — own it
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {!isLeg && (
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.6rem' }}>
                Executives own outcomes: every signature rolls implementation next week — competence
                decides whether it delivers or blows up.
              </p>
            )}
            {isLeg && (
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.6rem' }}>
                Skipped votes count as absences — the district notices.
              </p>
            )}
          </div>
        </div>
        <div className="dash-col">
          <div className="panel">
            <h3>The record</h3>
            <ul className="log">
              {[...gov.record].reverse().slice(0, 10).map((r, i) => (
                <li key={i} className={r.delta >= 0 ? 'log-action' : 'log-action_blocked'}>
                  wk {r.week}: {r.text}
                </li>
              ))}
              {gov.record.length === 0 && <li>Nothing on the record yet. That won’t last.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
