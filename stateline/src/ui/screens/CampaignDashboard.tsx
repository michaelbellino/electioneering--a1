import { useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { LineChart } from '@ui/components/LineChart'
import { InfluenceMap } from '@ui/screens/InfluenceMap'
import { TrailMap } from '@ui/screens/TrailMap'
import { DilemmaModal } from '@ui/screens/DilemmaModal'
import { MediaDesk } from '@ui/screens/MediaDesk'
import { actionAvailability, partyColor, pollSeries, pollSeriesAll, standings, weeksToElection } from '@ui/selectors'
import { CAMPAIGN_ACTIONS } from '@data/campaign/actions'
import { STAFF_POOL, MAX_OFFICES, officeCost } from '@data/campaign/staff'
import { getCommunity } from '@engine/territory/generate'
import type { GameState } from '@engine/index'
import { fmtUsd, fmtUsdDelta } from '@ui/format'
import { CashValue, FloatingDeltas, WeekSweep } from '@ui/juice'

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
            {(state.candidates[s.candidateId]?.scandalLoad ?? 0) > 0.05 && (
              <em className="scandal-chip">
                scandal {Math.round((state.candidates[s.candidateId]?.scandalLoad ?? 0) * 100)}
              </em>
            )}
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
    <div className="meter" role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="meter-label">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="meter-val">{pct}</span>
    </div>
  )
}

function Polling({ state }: { state: GameState }) {
  const all = pollSeriesAll(state)
  const two = pollSeries(state)
  const latestTwo = two[two.length - 1]
  const moe = Math.round((state.polls[state.polls.length - 1]?.marginOfError ?? 0) * 100)
  const lead = latestTwo ? latestTwo.player - latestTwo.opponent : 0
  const hasPolls = state.polls.length > 0

  return (
    <div className="panel">
      <h3>
        Polling {hasPolls && <span className="h3-aside">margin of error ±{moe} pts</span>}
      </h3>
      {!hasPolls ? (
        <div className="chart-empty">No polls yet — advance a week to get your first numbers.</div>
      ) : (
        <>
          <LineChart
            ariaLabel="Poll trend by week, one line per candidate"
            series={all.map((c) => ({ label: c.name, color: partyColor(c.party), points: c.points }))}
          />
          <div className="chart-legend chart-legend-wrap">
            {all.map((c) => (
              <span className="legend-item" key={c.candidateId}>
                <span className="dot" style={{ background: partyColor(c.party) }} />
                <span className="legend-name">{c.name}</span>
                <span className="legend-val" style={{ color: partyColor(c.party) }}>
                  {(c.points[c.points.length - 1] ?? 0).toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
          <div className="poll-margin">
            {Math.abs(lead) < 0.05 ? 'Dead heat at the top.' : lead > 0 ? `You lead the field by ${lead.toFixed(1)} pts.` : `You trail the leader by ${(-lead).toFixed(1)} pts.`}
          </div>
        </>
      )}
    </div>
  )
}

function RaceWire({ state }: { state: GameState }) {
  const all = pollSeriesAll(state)
  return (
    <div className="panel">
      <h3>Race Wire</h3>
      {Object.values(state.aiCandidates).map((ai) => {
        const c = state.candidates[ai.candidateId]!
        const series = all.find((x) => x.candidateId === ai.candidateId)?.points ?? []
        const now = series[series.length - 1] ?? 0
        const then = series[Math.max(0, series.length - 4)] ?? now
        const delta = now - then
        const town = state.territory.communities.find((cm) => cm.id === ai.location)
        // War-chest estimate is fuzzy: rounded to the nearest $25k (oppo work sharpens your read).
        const est = Math.round(ai.cash / 25_000_00) * 25
        return (
          <div className="standing" key={ai.candidateId}>
            <div className="standing-name">
              <span className="dot" style={{ background: partyColor(c.party) }} />
              {c.name}
              <em>
                {now.toFixed(0)}%{' '}
                {Math.abs(delta) >= 0.5 ? (delta > 0 ? '▲ rising' : '▼ fading') : '· steady'}
              </em>
            </div>
            <p className="wire-line muted">
              {ai.personality === 'attack_dog' ? 'Running a slash-and-burn operation' : ai.personality === 'insurgent' ? 'Running a ground-game insurgency' : 'Running a front-runner playbook'}
              {town ? `; last seen in ${town.name}` : ''}; war chest ≈ ${est}k.
            </p>
          </div>
        )
      })}
    </div>
  )
}

function Actions({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  const here = getCommunity(state.territory, state.territory.playerLocation)
  return (
    <div className="panel">
      <h3>
        Campaign Actions
        {here && <span className="h3-aside">on the ground in {here.name}</span>}
      </h3>
      <div className="actions">
        {CAMPAIGN_ACTIONS.map((def) => {
          const avail = actionAvailability(state, def)
          const isGain = Boolean(def.fundraising)
          const isLocal = ['event', 'ground_game', 'message'].includes(def.category)
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
                <span>
                  {def.actionPointCost} AP{isLocal && here ? ` · here in ${here.name}` : ' · district-wide'}
                </span>
                {!avail.ok && <span className="action-block">{avail.reason}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Hq({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  const hired = new Set(state.campaign.staff.map((s) => s.id))
  const offices = state.campaign.offices
  const nextOffice = officeCost(offices)
  return (
    <div className="panel">
      <h3>
        The Team
        <span className="h3-aside">
          payroll {fmtUsd(Math.round(state.campaign.staff.reduce((a, s) => a + s.weeklySalary, 0) * state.campaign.modifiers.salaryMult))}/wk
        </span>
      </h3>
      <div className="hq-staff">
        {STAFF_POOL.map((def) => {
          const isHired = hired.has(def.id)
          return (
            <div key={def.id} className={`hq-row ${isHired ? 'hired' : ''}`}>
              <div className="hq-info">
                <strong>{def.name}</strong>
                <span>{def.blurb}</span>
              </div>
              {isHired ? (
                <button className="btn btn-sm" onClick={() => dispatch({ type: 'campaign/fireStaff', payload: { staffId: def.id } })}>
                  Let go
                </button>
              ) : (
                <button className="btn btn-sm" onClick={() => dispatch({ type: 'campaign/hireStaff', payload: { staffId: def.id } })}>
                  Hire · {fmtUsd(def.signingBonus)} + {fmtUsd(def.weeklySalary)}/wk · 1 AP
                </button>
              )}
            </div>
          )
        })}
        <div className="hq-row">
          <div className="hq-info">
            <strong>Field offices ({offices}/{MAX_OFFICES})</strong>
            <span>Each office adds +5% to everything you do on the ground.</span>
          </div>
          {offices < MAX_OFFICES && (
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'campaign/openOffice', payload: {} })}>
              Open · {fmtUsd(nextOffice)} · 1 AP
            </button>
          )}
        </div>
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

type View = 'trail' | 'media' | 'war_room' | 'influence'

export function CampaignDashboard() {
  const state = useGame((s) => s.state)
  const advanceTurn = useGame((s) => s.advanceTurn)
  const save = useGame((s) => s.save)
  const [saved, setSaved] = useState(false)
  const [view, setView] = useState<View>('trail')
  if (!state) return null

  const weeks = weeksToElection(state)
  const ap = state.campaign.actionPoints
  const maxAp = state.campaign.maxActionPoints

  const TABS: Array<{ id: View; label: string }> = [
    { id: 'trail', label: 'The Trail' },
    { id: 'media', label: 'Media & Polling' },
    { id: 'war_room', label: 'War Room' },
    { id: 'influence', label: 'Influence Map' },
  ]

  return (
    <div className="dashboard screen-in">
      <DilemmaModal state={state} />
      <FloatingDeltas />
      <WeekSweep />
      <div className="dash-bar panel">
        <div className="dash-title">
          <strong>{state.election.title}</strong>
          <span className="muted">
            {weeks === 0 ? 'Election week' : `${weeks} week${weeks === 1 ? '' : 's'} to election day`}
          </span>
        </div>
        <div className="view-tabs" role="tablist" aria-label="Dashboard view">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={view === tab.id}
              className={`tab ${view === tab.id ? 'active' : ''}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="dash-stats">
          <div className="stat">
            <span className="stat-label">Cash</span>
            <CashValue cents={state.campaign.finance.cash} />
          </div>
          <div className="stat">
            <span className="stat-label">Action points</span>
            <ApPips spent={maxAp - ap} max={maxAp} />
          </div>
          <button
            className="btn"
            onClick={() => {
              save()
              setSaved(true)
              setTimeout(() => setSaved(false), 1500)
            }}
          >
            {saved ? 'Saved ✓' : 'Save'}
          </button>
          <button className="btn btn-primary" onClick={advanceTurn}>
            Advance week →
          </button>
        </div>
      </div>

      {view === 'influence' && <InfluenceMap state={state} />}
      {view === 'media' && <MediaDesk state={state} />}
      {view === 'trail' && (
        <div className="trail-grid">
          <TrailMap state={state} />
          <div className="dash-col">
            <Actions state={state} />
          </div>
        </div>
      )}
      {view === 'war_room' && (
        <div className="dash-grid">
          <div className="dash-col">
            <Polling state={state} />
            <Standings state={state} />
          </div>
          <div className="dash-col">
            <Hq state={state} />
            <Finance state={state} />
          </div>
          <div className="dash-col">
            <RaceWire state={state} />
            <Log state={state} />
          </div>
        </div>
      )}
    </div>
  )
}
