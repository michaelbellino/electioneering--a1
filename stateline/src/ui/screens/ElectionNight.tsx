import { useGame } from '@ui/store/gameStore'
import { partyColor } from '@ui/selectors'

export function ElectionNight() {
  const state = useGame((s) => s.state)
  const reset = useGame((s) => s.reset)
  if (!state || !state.result) return null

  const result = state.result
  const won = result.winnerIds[0] === state.playerCandidateId
  const ordered = [...state.election.candidateIds].sort(
    (a, b) => (result.sharesByCandidate[b] ?? 0) - (result.sharesByCandidate[a] ?? 0),
  )
  const winnerId = result.winnerIds[0] ?? ''
  const winner = state.candidates[winnerId]
  const marginPts = (result.margin * 100).toFixed(1)

  return (
    <div className="election-night">
      <div className={`result-banner ${won ? 'win' : 'lose'}`}>
        <span className="result-kicker">{state.election.title} · Results</span>
        <h1>{won ? 'You win the seat!' : `${winner?.name ?? 'Your opponent'} takes the seat`}</h1>
        <p>
          {won ? 'Won' : 'Lost'} by {marginPts} pts · turnout {(result.turnout * 100).toFixed(1)}%
        </p>
      </div>

      <div className="panel result-bars">
        <h3>Final vote share</h3>
        {ordered.map((id) => {
          const share = (result.sharesByCandidate[id] ?? 0) * 100
          const c = state.candidates[id]
          const isWinner = result.winnerIds[0] === id
          return (
            <div className="result-row" key={id}>
              <div className="result-name">
                <span className="dot" style={{ background: partyColor(c?.party ?? 'I') }} />
                <span className="who">{c?.name ?? id}</span>
                {isWinner && <span className="winner-tag">Winner</span>}
              </div>
              <div className="result-track">
                <div
                  className="result-fill"
                  style={{ width: `${share}%`, background: partyColor(c?.party ?? 'I') }}
                />
              </div>
              <div className="result-pct">{share.toFixed(1)}%</div>
            </div>
          )
        })}
      </div>

      <div className="election-actions">
        <button className="btn btn-primary btn-lg" onClick={reset}>
          Run another campaign
        </button>
      </div>
    </div>
  )
}
