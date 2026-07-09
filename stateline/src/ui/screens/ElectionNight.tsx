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

  return (
    <div className="election-night">
      <div className={`result-banner ${won ? 'win' : 'lose'}`}>
        <span className="result-kicker">{state.election.title} · Results</span>
        <h1>{won ? 'Projected Winner — You!' : 'You Lost This One'}</h1>
        <p>
          Turnout {(result.turnout * 100).toFixed(1)}% · margin {(result.margin * 100).toFixed(1)} pts
        </p>
      </div>

      <div className="panel result-bars">
        {ordered.map((id) => {
          const share = (result.sharesByCandidate[id] ?? 0) * 100
          const c = state.candidates[id]
          const isWinner = result.winnerIds[0] === id
          return (
            <div className="result-row" key={id}>
              <div className="result-name">
                <span className="dot" style={{ background: partyColor(c?.party ?? 'I') }} />
                {c?.name ?? id} {isWinner && <span className="winner-tag">✓ won</span>}
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

      <button className="btn btn-primary" onClick={reset}>
        ← Run another campaign
      </button>
    </div>
  )
}
