import { useMemo, useState } from 'react'
import type { GameState } from '@engine/index'
import { currentProfiles } from '@engine/reducer'
import { communityStandings } from '@engine/territory/local'
import { areAdjacent, getCommunity, type Community } from '@engine/territory/generate'
import { useGame } from '@ui/store/gameStore'
import { partyColor } from '@ui/selectors'

const CELL = 96
const PAD = 44

const ARCHETYPE_LABEL: Record<Community['archetype'], string> = {
  urban: 'Urban core',
  suburban: 'Suburbs',
  town: 'Small town',
  rural: 'Rural',
}

/** Mix two hex colors; t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function TrailMap({ state, results = false }: { state: GameState; results?: boolean }) {
  const dispatch = useGame((s) => s.dispatch)
  const [selected, setSelected] = useState<string | null>(null)
  const t = state.territory
  const day = state.calendar.dayIndex

  const player = state.candidates[state.playerCandidateId]!
  const oppId = state.election.candidateIds.find((id) => id !== state.playerCandidateId)!
  const opp = state.candidates[oppId]!
  const youColor = partyColor(player.party)
  const oppColor = partyColor(opp.party)

  // In results mode everyone's cards are face-up; during the campaign you know what you've canvassed.
  const standings = useMemo(
    () =>
      results
        ? new Map(
            communityStandings(state.electorate, currentProfiles(state), state.playerCandidateId, t).map(
              (r) => [r.communityId, r.playerShare],
            ),
          )
        : null,
    [results, state.meta.revision], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const w = Math.max(...t.communities.map((c) => c.x)) * CELL + PAD * 2
  const h = Math.max(...t.communities.map((c) => c.y)) * CELL + PAD * 2
  const px = (c: Community) => ({ cx: c.x * CELL + PAD, cy: c.y * CELL + PAD })
  const r = (c: Community) => 14 + Math.sqrt(c.weight) * 46

  const edges = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<[Community, Community]> = []
    for (const c of t.communities) {
      for (const n of c.neighbors) {
        const key = [c.id, n].sort().join(':')
        if (seen.has(key)) continue
        seen.add(key)
        const other = getCommunity(t, n)
        if (other) out.push([c, other])
      }
    }
    return out
  }, [t])

  const fillFor = (c: Community): { fill: string; known: boolean; share: number | null; stale: boolean } => {
    if (results && standings) {
      const share = standings.get(c.id) ?? 0.5
      return { fill: mix(oppColor, youColor, Math.max(0.12, Math.min(0.88, (share - 0.3) / 0.4))), known: true, share, stale: false }
    }
    const intel = t.intel[c.id]
    if (!intel) return { fill: '#1a2230', known: false, share: null, stale: false }
    const stale = day - intel.day > 21
    return {
      fill: mix(oppColor, youColor, Math.max(0.12, Math.min(0.88, (intel.playerShare - 0.3) / 0.4))),
      known: true,
      share: intel.playerShare,
      stale,
    }
  }

  const sel = selected ? getCommunity(t, selected) : null
  const selInfo = sel ? fillFor(sel) : null
  const adjacentToPlayer = sel ? areAdjacent(t, t.playerLocation, sel.id) : false

  return (
    <div className="trail">
      <div className="trail-map-wrap panel">
        <h3>
          The Trail
          {!results && (
            <span className="h3-aside">
              fog of war — canvass to see local numbers · color = who leads
            </span>
          )}
        </h3>
        <div className="trail-scroll">
          <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w * 0.85, maxWidth: '100%' }} role="group" aria-label="District map">
            {edges.map(([a, b], i) => {
              const pa = px(a)
              const pb = px(b)
              return <line key={i} x1={pa.cx} y1={pa.cy} x2={pb.cx} y2={pb.cy} className="trail-road" />
            })}
            {t.communities.map((c, ci) => {
              const { cx, cy } = px(c)
              const info = fillFor(c)
              const presence = t.presence[c.id] ?? 0
              const active = selected === c.id
              return (
                <g
                  key={c.id}
                  transform={`translate(${cx}, ${cy})`}
                  className={`town ${active ? 'town-active' : ''} ${results ? 'town-reveal' : ''}`}
                  style={results ? { animationDelay: `${ci * 70}ms` } : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.name}, ${ARCHETYPE_LABEL[c.archetype]}${info.share !== null ? `, you at ${Math.round(info.share * 100)}%` : ', no local data'}`}
                  onClick={() => setSelected(active ? null : c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(active ? null : c.id)
                    }
                  }}
                >
                  {presence > 0.05 && !results && (
                    <circle r={r(c) + 5} className="presence-ring" style={{ opacity: Math.min(0.9, presence) }} />
                  )}
                  <circle r={r(c)} fill={info.fill} className={`town-circle ${info.known ? '' : 'town-fog'} ${info.stale ? 'town-stale' : ''}`} />
                  {!info.known && (
                    <text className="town-fog-mark" y={5}>
                      ?
                    </text>
                  )}
                  {info.share !== null && (
                    <text className="town-share" y={5}>
                      {Math.round(info.share * 100)}
                      {info.stale ? '~' : ''}
                    </text>
                  )}
                  <text className="town-name" y={r(c) + 16}>
                    {c.name}
                  </text>
                </g>
              )
            })}
            {/* Candidate markers live on their own layer so they GLIDE between towns on travel. */}
            {!results && (
              <g className="marker-layer" aria-hidden="true">
                {Object.values(state.aiCandidates).map((ai, i) => {
                  const c = getCommunity(t, ai.location)
                  if (!c) return null
                  const { cx, cy } = px(c)
                  return (
                    <g
                      key={ai.candidateId}
                      className="cand-marker"
                      style={{ transform: `translate(${cx + r(c) - 10 - i * 13}px, ${cy - r(c) - 4}px)` }}
                    >
                      <text className="town-marker opp">▲</text>
                    </g>
                  )
                })}
                {(() => {
                  const c = getCommunity(t, t.playerLocation)
                  if (!c) return null
                  const { cx, cy } = px(c)
                  return (
                    <g className="cand-marker you-marker" style={{ transform: `translate(${cx - r(c) - 6}px, ${cy - r(c) - 2}px)` }}>
                      <text className="town-marker you">★</text>
                    </g>
                  )
                })()}
              </g>
            )}
          </svg>
        </div>
        <div className="trail-legend">
          <span className="legend-key">
            <span className="dot" style={{ background: youColor }} /> you lead
          </span>
          <span className="legend-key">
            <span className="dot" style={{ background: oppColor }} /> they lead
          </span>
          {!results && (
            <>
              <span className="legend-key"><span className="fog-chip">?</span> not canvassed</span>
              <span className="legend-key">★ you · ▲ opponent</span>
              <span className="legend-key"><span className="ring-chip" /> your ground game</span>
            </>
          )}
        </div>
      </div>

      {sel && (
        <div className="panel trail-detail">
          <h3>
            {sel.name}
            <span className="h3-aside">{ARCHETYPE_LABEL[sel.archetype]} · {(sel.weight * 100).toFixed(0)}% of voters</span>
          </h3>
          <p className="muted">
            {selInfo?.share !== null && selInfo
              ? `Your canvass ${selInfo.stale ? '(stale — over 3 weeks old) ' : ''}puts you at ${Math.round((selInfo.share ?? 0) * 100)}% here. Around here it's all about ${sel.topIssueId.replace('_', ' & ')}.`
              : 'No local data. Canvass here (or next door) to learn how it breaks — and what it cares about.'}
            {(t.presence[sel.id] ?? 0) > 0.05 && ` Ground presence: ${Math.round((t.presence[sel.id] ?? 0) * 100)}%.`}
          </p>
          {!results && sel.id !== t.playerLocation && (
            <button
              className="btn"
              onClick={() => {
                dispatch({ type: 'campaign/travel', payload: { communityId: sel.id } })
                setSelected(null)
              }}
            >
              {adjacentToPlayer ? `Drive to ${sel.name} (free)` : `Bus tour to ${sel.name} (1 AP)`}
            </button>
          )}
          {!results && sel.id === t.playerLocation && (
            <p className="muted">You're here now — local actions land in {sel.name} and spill to its neighbors.</p>
          )}
        </div>
      )}
    </div>
  )
}
