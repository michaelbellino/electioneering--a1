import { useGame } from '@ui/store/gameStore'
import { LineChart } from '@ui/components/LineChart'
import { actionAvailability, partyColor, pollSeries, standings, weeksToElection } from '@ui/selectors'
import { CAMPAIGN_ACTIONS } from '@data/campaign/actions'
import type { GameState } from '@engine/index'
import { formatUsd } from '@engine/core/primitives'

function Standings({ state }: { state: GameState }) {
  const rows = standings(state)
  return (
    <div className="panel">
      <h3>The Race</h3>
      {rows.map((s) => (
        <div className="standing" key={s.candidateId}>
          <div className="standing-name">
            <span className="dot" style={{ background: partyColor(s.party) }} />
            {s.name} {s.candidateId === state.playerCandidateId && <em>(you)</em>}
          </div>
          <div className="meters">
            <Meter label="Name rec." value={s.awareness} color={partyColor(s.party)} />
            <Meter label="Favorability" value={(s.favorability + 1) / 2} color={partyColor(s.party)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
      <span className="meter-val">{Math.round(value * 100)}</span>
    </div>
  )
}

function Polling({ state }: { state: GameState }) {
  const series = pollSeries(state)
  const latest = series[series.length - 1]
  const playerParty = state.candidates[state.playerCandidateId]?.party ?? 'I'
  const oppId = state.election.candidateIds.find((id) => id !== state.playerCandidateId)!
  const oppParty = state.candidates[oppId]?.party ?? 'I'
  const moe = Math.round((state.polls[state.polls.length - 1]?.marginOfError ?? 0) * 100)
  return (
    <div className="panel">
      <h3>
        Polling {latest && <span className="muted">±{moe} pts</span>}
      </h3>
      {series.length === 0 ? (
        <p className="muted">No polls yet — advance a week.</p>
      ) : (
        <>
          <LineChart
            series={[
              { label: 'you', color: partyColor(playerParty), points: series.map((p) => p.player) },
              { label: 'opp', color: partyColor(oppParty), points: series.map((p) => p.opponent) },
            ]}
          />
          {latest && (
            <div className="poll-readout">
              <span style={{ color: partyColor(playerParty) }}>You {latest.player.toFixed(1)}%</span>
              <span style={{ color: partyColor(oppParty) }}>Opp {latest.opponent.toFixed(1)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Actions({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  return (
    <div className="panel">
      <h3>Campaign Actions</h3>
      <div className="actions">
        {CAMPAIGN_ACTIONS.map((def) => {
          const avail = actionAvailability(state, def)
          return (
            <button
              key={def.id}
              className="action-card"
              disabled={!avail.ok}
              title={def.description}
              onClick={() => dispatch({ type: 'campaign/action', payload: { defId: def.id } })}
            >
              <div className="action-top">
                <span className="action-label">{def.label}</span>
                <span className="action-cost">
                  {def.fundraising ? `+${formatUsd(def.fundraising.baseAmount)}` : formatUsd(def.cashCost)}
                </span>
              </div>
              <div className="action-meta">
                <span>{def.actionPointCost} AP</span>
                {!avail.ok && <span className="action-block">{avail.reason}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Finance({ state }: { state: GameState }) {
  const f = state.campaign.finance
  return (
    <div className="panel">
      <h3>War Chest</h3>
      <div className="finance-row big">
        <span>Cash on hand</span>
        <strong className={f.cash < 0 ? 'neg' : ''}>{formatUsd(f.cash)}</strong>
      </div>
      <div className="finance-row">
        <span>Raised</span>
        <span>{formatUsd(f.totalRaised)}</span>
      </div>
      <div className="finance-row">
        <span>Spent</span>
        <span>{formatUsd(f.totalSpent)}</span>
      </div>
      <div className="finance-row">
        <span>Action points</span>
        <span>
          {state.campaign.actionPoints} / {state.campaign.maxActionPoints}
        </span>
      </div>
    </div>
  )
}

function Log({ state }: { state: GameState }) {
  const recent = state.log.slice(-7).reverse()
  return (
    <div className="panel">
      <h3>Latest</h3>
      <ul className="log">
        {recent.map((l, i) => (
          <li key={i} className={`log-${l.kind}`}>
            {l.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CampaignDashboard() {
  const state = useGame((s) => s.state)
  const advanceTurn = useGame((s) => s.advanceTurn)
  if (!state) return null

  return (
    <div className="dashboard">
      <div className="dash-bar">
        <div>
          <strong>{state.election.title}</strong>
          <span className="muted"> · {weeksToElection(state)} weeks to election day</span>
        </div>
        <button className="btn btn-primary" onClick={advanceTurn}>
          Advance week →
        </button>
      </div>
      <div className="dash-grid">
        <div className="dash-col">
          <Actions state={state} />
          <Finance state={state} />
        </div>
        <div className="dash-col">
          <Polling state={state} />
          <Standings state={state} />
        </div>
        <div className="dash-col">
          <Log state={state} />
        </div>
      </div>
    </div>
  )
}
