import { useGame } from '@ui/store/gameStore'
import { partyColor } from '@ui/selectors'
import { TrailMap } from '@ui/screens/TrailMap'
import { getDifficulty } from '@data/campaign/difficulties'
import { getTrait } from '@data/campaign/traits'
import { useCountUp } from '@ui/juice'

function TallyPct({ value }: { value: number }) {
  const v = useCountUp(value, 1600)
  return <div className="result-pct">{v.toFixed(1)}%</div>
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 61) % 100}%`,
            animationDelay: `${(i % 12) * 0.12}s`,
            animationDuration: `${2.4 + ((i * 7) % 10) / 6}s`,
            background: ['var(--dem)', 'var(--gop)', 'var(--gold)', 'var(--ind)', '#e9eef5'][i % 5],
          }}
        />
      ))}
    </div>
  )
}

export function ElectionNight() {
  const state = useGame((s) => s.state)
  const reset = useGame((s) => s.reset)
  const rematch = useGame((s) => s.rematch)
  const dispatch = useGame((s) => s.dispatch)
  const goTo = useGame((s) => s.goTo)
  if (!state || !state.result) return null

  const result = state.result
  const won = result.winnerIds[0] === state.playerCandidateId
  const ordered = [...state.election.candidateIds].sort(
    (a, b) => (result.sharesByCandidate[b] ?? 0) - (result.sharesByCandidate[a] ?? 0),
  )
  const winnerId = result.winnerIds[0] ?? ''
  const winner = state.candidates[winnerId]
  const marginPts = (result.margin * 100).toFixed(1)
  const difficulty = getDifficulty(state.meta.difficulty)
  const traits = state.meta.traitIds.map((id) => getTrait(id)?.label).filter(Boolean)

  return (
    <div className="election-night screen-in">
      {won && <Confetti />}
      <div className={`result-banner banner-in ${won ? 'win' : 'lose'}`}>
        <span className="result-kicker">{state.election.title} · Results</span>
        <h1>{won ? 'You win the seat!' : `${winner?.name ?? 'Your opponent'} takes the seat`}</h1>
        <p>
          {won ? 'Won' : 'Lost'} by {marginPts} pts · turnout {(result.turnout * 100).toFixed(1)}%
        </p>
        <ul className="run-summary">
          <li>{difficulty.label}</li>
          {traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li className="num">seed {state.meta.seed}</li>
        </ul>
      </div>

      <div className="panel result-bars">
        <h3>Final vote share</h3>
        {ordered.map((id) => {
          const share = (result.sharesByCandidate[id] ?? 0) * 100
          const c = state.candidates[id]
          const isWinner = result.winnerIds[0] === id
          return (
            <div className="result-row" key={id} style={{ animationDelay: `${0.2 + ordered.indexOf(id) * 0.25}s` }}>
              <div className="result-name">
                <span className="dot" style={{ background: partyColor(c?.party ?? 'I') }} />
                <span className="who">{c?.name ?? id}</span>
                {isWinner && <span className="winner-tag">Winner</span>}
              </div>
              <div className="result-track">
                <div
                  className="result-fill bar-grow"
                  style={{ width: `${share}%`, background: partyColor(c?.party ?? 'I'), animationDelay: `${0.3 + ordered.indexOf(id) * 0.25}s` }}
                />
              </div>
              <TallyPct value={share} />
            </div>
          )
        })}
      </div>

      <TrailMap state={state} results />

      <div className="election-actions">
        {won && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              dispatch({ type: 'gov/takeOffice', payload: {} })
              goTo('campaign')
            }}
          >
            Take office →
          </button>
        )}
        <button className="btn" onClick={rematch}>
          ↻ Run it back (same seed)
        </button>
        <button className={won ? 'btn' : 'btn btn-primary btn-lg'} onClick={reset}>
          New campaign
        </button>
      </div>
    </div>
  )
}
