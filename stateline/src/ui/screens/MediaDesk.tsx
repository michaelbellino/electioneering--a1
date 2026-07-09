import { useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import type { GameState } from '@engine/index'
import { AD_CHANNELS, AD_FATIGUE_RATE, adCost, type AdBudget } from '@data/campaign/advertising'
import { POLICIES } from '@data/policies'
import { fmtUsd } from '@ui/format'
import { formatDate } from '@engine/core/calendar'

const BUDGETS: Array<{ v: AdBudget; label: string }> = [
  { v: 1, label: 'Small' },
  { v: 2, label: 'Medium' },
  { v: 3, label: 'Saturation' },
]
const TONES = [
  { id: 'positive', label: 'Positive', hint: 'Build your name and image.' },
  { id: 'attack', label: 'Attack', hint: 'Hit a specific opponent position — backfires if voters agree with it.' },
  { id: 'issue', label: 'Issue', hint: 'Move public opinion itself toward your side (capped per campaign).' },
]

export function MediaDesk({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch)
  const [channel, setChannel] = useState('tv')
  const [tone, setTone] = useState('positive')
  const [policyId, setPolicyId] = useState(POLICIES[0]!.id)
  const [budget, setBudget] = useState<AdBudget>(1)

  const ch = AD_CHANNELS.find((c) => c.id === channel)!
  const cost = adCost(ch, budget, state.electorate.cvap)
  const fatigue = state.campaign.adFatigue[channel] ?? 0
  const fatiguePct = Math.round((1 - 1 / (1 + AD_FATIGUE_RATE * fatigue)) * 100)
  const needsPolicy = tone !== 'positive'

  return (
    <div className="dash-grid media-grid">
      <div className="panel">
        <h3>Ad Studio</h3>
        <div className="field">
          <span>Channel</span>
          <div className="seg">
            {AD_CHANNELS.map((c) => (
              <button key={c.id} className={`seg-btn ${channel === c.id ? 'active' : ''}`} aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="attr-hint">{ch.blurb}{ch.id === 'mail' ? ' Lands where you’re standing on the map.' : ''}</p>
        </div>
        <div className="field">
          <span>Message</span>
          <div className="seg">
            {TONES.map((t) => (
              <button key={t.id} className={`seg-btn ${tone === t.id ? 'active' : ''}`} aria-pressed={tone === t.id} onClick={() => setTone(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="attr-hint">{TONES.find((t) => t.id === tone)!.hint}</p>
        </div>
        {needsPolicy && (
          <label className="field">
            <span>{tone === 'attack' ? 'Attack their position on…' : 'Make the case for your side of…'}</span>
            <select className="policy-select" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              {POLICIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="field">
          <span>Budget</span>
          <div className="seg">
            {BUDGETS.map((b) => (
              <button key={b.v} className={`seg-btn ${budget === b.v ? 'active' : ''}`} aria-pressed={budget === b.v} onClick={() => setBudget(b.v)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ad-summary">
          <span className="num">{fmtUsd(cost)} · 1 AP</span>
          {fatiguePct > 0 && <span className="action-block">audience fatigue −{fatiguePct}%</span>}
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            dispatch({
              type: 'campaign/runAd',
              payload: { channel, tone, budget, ...(needsPolicy ? { policyId } : {}) },
            })
          }
        >
          Run the ad →
        </button>
      </div>

      <div className="panel">
        <h3>Polling Desk</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          The weekly tracking poll is free. Real intelligence costs money{state.campaign.staff.some((s) => s.role === 'pollster') ? ' (half price — you have a pollster)' : ''}.
        </p>
        <div className="actions">
          {[
            { kind: 'crosstabs', label: 'Demographic crosstabs', desc: 'Support and turnout by segment — who is actually with you.' },
            { kind: 'issues', label: 'Policy sentiment', desc: 'District agreement with every one of your 24 policy stances — find the winners and the landmines.' },
            { kind: 'communities', label: 'Community tracking poll', desc: 'Local numbers for the 5 biggest places you haven’t canvassed — feeds the map.' },
            { kind: 'opponent', label: 'Opposition research', desc: 'Their platform policy by policy, district agreement with each — and which positions are attackable.' },
          ].map((p) => (
            <button key={p.kind} className="action-card" onClick={() => dispatch({ type: 'campaign/commissionPoll', payload: { kind: p.kind } })}>
              <div className="action-top">
                <span className="action-label">{p.label}</span>
              </div>
              <div className="action-desc">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel report-panel">
        <h3>Research Reports</h3>
        {state.pollReports.length === 0 ? (
          <p className="muted">Nothing commissioned yet.</p>
        ) : (
          [...state.pollReports].reverse().slice(0, 3).map((r, i) => (
            <details key={i} open={i === 0} className="report">
              <summary>
                {r.title} <span className="muted num">{formatDate(r.day)} · {fmtUsd(r.cost)}</span>
              </summary>
              <div className="influence-table-wrap">
                <table className="influence-table">
                  <thead>
                    <tr>{r.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {r.rows.map((row, j) => (
                      <tr key={j}>{row.map((cell, k) => <td key={k} className="num">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  )
}
