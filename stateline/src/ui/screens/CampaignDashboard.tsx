import { useGame } from '@ui/store/gameStore'
import { LineChart } from '@ui/components/LineChart'
import { actionAvailability, partyColor, pollSeries, standings, weeksToElection } from '@ui/selectors'
import { CAMPAIGN_ACTIONS } from '@data/campaign/actions'
import type { GameState } from '@engine/index'
import { fmtUsd, fmtUsdDelta } from '@ui/format'

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
  const pct = Math.round(value * 100)
  return (
    <div
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="meter-label">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="meter-val">{pct}</span>
    </div>
  )
}

function Polling({ state }: { state: GameState }) {
  const series = pollSeries(state)
  const latest = series[series.length - 1]
  const player = state.candidates[state.playerCandidateId]
  const oppId = state.election.candidateIds.find((id) => id !== state.playerCandidateId)!
  const opp = state.candidates[oppId]
  const playerParty = player?.party ?? 'I'
  const oppParty = opp?.party ?? 'I'
  const moe = Math.round((state.polls[state.polls.length - 1]?.marginOfError ?? 0) * 100)
  const lead = latest ? latest.player - latest.opponent : 0

  return (
    <div className="panel">
      <h3>
        Polling {latest && <span className="h3-aside">margin of error ±{moe} pts</span>}
      </h3>
      {series.length === 0 ? (
        <div className="chart-empty">No polls yet — advance a week to get your first numbers.</div>
      ) : (
        <>
          <LineChart
            ariaLabel="Poll trend by week"
            series={[
              { label: 'you', color: partyColor(playerParty), points: series.map((p) => p.player) },
              { label: 'opp', color: partyColor(oppParty), points: series.map((p) => p.opponent) },
            ]}
          />
          {latest && (
            <>
              <div className="chart-legend">
                <span className="legend-item">
                  <span className="dot" style={{ background: partyColor(playerParty) }} />
                  <span className="legend-name">{player?.name ?? 'You'}</span>
                  <span className="legend-val" style={{ color: partyColor(playerParty) }}>
                    {latest.player.toFixed(1)}%
                  </span>
                </span>
                <span className="legend-item">
                  <span className="dot" style={{ background: partyColor(oppParty) }} />
                  <span className="legend-name">{opp?.name ?? 'Opponent'}</span>
                  <span className="legend-val" style={{ color: partyColor(oppParty) }}>
                    {latest.opponent.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="poll-margin">
                {Math.abs(lead) < 0.05
                  ? 'Dead heat.'
                  : lead > 0
                    ? `You lead by ${lead.toFixed(1)} pts.`
                    : `You trail by ${(-lead).toFixed(1)} pts.`}
              </div>
            </>
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
          const isGain = Boolean(def.fundraising)
          return (
            <button
              key={def.id}
              className="action-card"
              disabled={!avail.ok}
              onClick={() => dispatch({ type: 'campaign/action', payload: { defId: def.id } })}
            >
              <div className="action-top">
                <span className="action-label">{def.label}</span>
                <span className={`action-cost ${isGain ? 'gain' : ''}`}>
                  {def.fundraising ? fmtUsdDelta(def.fundraising.baseAmount) : fmtUsdDelta(-def.cashCost)}
                </span>
              </div>
              <div className="action-desc">{def.description}</div>
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
        <strong className={f.cash < 0 ? 'neg' : ''}>{fmtUsd(f.cash)}</strong>
      </div>
      <div className="finance-row">
        <span>Raised</span>
        <span>{fmtUsd(f.totalRaised)}</span>
      </div>
      <div className="finance-row">
        <span>Spent</span>
        <span>{fmtUsd(f.totalSpent)}</span>
      </div>
    </div>
  )
}

function Log({ state }: { state: GameState }) {
  const recent = state.log.slice(-8).reverse()
  return (
    <div className="panel">
      <h3>Campaign Log</h3>
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

function ApPips({ spent, max }: { spent: number; max: number }) {
  return (
    <span className="ap-pips" aria-label={`${max - spent} of ${max} action points remaining`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`ap-pip ${i < max - spent ? '' : 'spent'}`} />
      ))}
    </span>
  )
}

export function CampaignDashboard() {
  const state = useGame((s) => s.state)
  const advanceTurn = useGame((s) => s.advanceTurn)
  if (!state) return null

  const weeks = weeksToElection(state)
  const ap = state.campaign.actionPoints
  const maxAp = state.campaign.maxActionPoints

  return (
    <div className="dashboard">
      <div className="dash-bar panel">
        <div className="dash-title">
          <strong>{state.election.title}</strong>
          <span className="muted">
            {weeks === 0 ? 'Election week' : `${weeks} week${weeks === 1 ? '' : 's'} to election day`}
          </span>
        </div>
        <div className="dash-stats">
          <div className="stat">
            <span className="stat-label">Cash</span>
            <span className="stat-value">{fmtUsd(state.campaign.finance.cash)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Action points</span>
            <ApPips spent={maxAp - ap} max={maxAp} />
          </div>
          <button className="btn btn-primary" onClick={advanceTurn}>
            Advance week →
          </button>
        </div>
      </div>
      <div className="dash-grid">
        <div className="dash-col">
          <Actions state={state} />
        </div>
        <div className="dash-col">
          <Polling state={state} />
          <Standings state={state} />
        </div>
        <div className="dash-col">
          <Finance state={state} />
          <Log state={state} />
        </div>
      </div>
    </div>
  )
}
