import { useMemo, useState } from 'react'
import type { GameState } from '@engine/index'
import { influenceVM, NODE_H, NODE_W, type VMEdge, type VMNode } from '@ui/causal'

const KIND_TITLES: Record<string, string> = {
  action: 'Actions',
  lever: 'Your levers',
  outcome: 'Outcome',
  segment: 'Voter groups',
  issue: 'Issues',
}

function edgePath(e: VMEdge): string {
  const dx = (e.x2 - e.x1) / 2
  return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`
}

function edgeSentence(e: VMEdge, name: (id: string) => string): string {
  return `${name(e.source)} → ${name(e.target)}: ${e.label}`
}

export function InfluenceMap({ state }: { state: GameState }) {
  const vm = useMemo(() => influenceVM(state), [state.meta.revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<string | null>(null)
  const [tableView, setTableView] = useState(false)

  const nodeName = (id: string) => vm.nodes.find((n) => n.id === id)?.label ?? id
  const touching = (id: string) => vm.edges.filter((e) => e.source === id || e.target === id)
  const isDim = (e: VMEdge) => selected !== null && e.source !== selected && e.target !== selected
  const selectedNode = vm.nodes.find((n) => n.id === selected) ?? null

  const columns = useMemo(() => {
    const seen = new Map<number, VMNode>()
    for (const n of vm.nodes) if (!seen.has(n.col)) seen.set(n.col, n)
    return [...seen.values()]
  }, [vm])

  return (
    <div className="panel influence">
      <div className="influence-head">
        <h3>Influence Map</h3>
        <div className="influence-tools">
          <span className="legend-key">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="25" y2="4" className="edge-pos" strokeWidth="3" />
            </svg>
            helps you
          </span>
          <span className="legend-key">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="25" y2="4" className="edge-neg" strokeWidth="3" />
            </svg>
            works against you
          </span>
          <span className="legend-key muted">thickness = strength</span>
          <button className="btn btn-sm" onClick={() => setTableView((v) => !v)}>
            {tableView ? 'View as map' : 'View as table'}
          </button>
        </div>
      </div>
      <p className="muted influence-sub">
        How the simulation actually works: every arrow is a live sensitivity measured from the voter
        model this turn — spend where the thick green arrows are. Click a node to trace its links.
      </p>

      {tableView ? (
        <div className="influence-table-wrap">
          <table className="influence-table">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Direction</th>
                <th scope="col">Effect</th>
              </tr>
            </thead>
            <tbody>
              {[...vm.edges]
                .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
                .map((e, i) => (
                  <tr key={i}>
                    <td>{nodeName(e.source)}</td>
                    <td>{nodeName(e.target)}</td>
                    <td className={e.weight >= 0 ? 'pos' : 'neg'}>
                      {e.weight >= 0 ? 'helps you' : 'against you'}
                    </td>
                    <td className="num">{e.label}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="influence-scroll">
          <svg
            viewBox={`0 -26 ${vm.width} ${vm.height + 26}`}
            style={{ minWidth: vm.width, height: vm.height + 26 }}
            role="group"
            aria-label="Causal influence map. Use the table view for a screen-reader-friendly version."
          >
            {columns.map((n) => (
              <text key={n.col} x={n.x + NODE_W / 2} y={-10} className="col-title">
                {KIND_TITLES[n.kind]}
              </text>
            ))}
            {vm.edges.map((e, i) => (
              <path
                key={i}
                d={edgePath(e)}
                className={`edge ${e.weight >= 0 ? 'edge-pos' : 'edge-neg'} ${isDim(e) ? 'edge-dim' : ''}`}
                strokeWidth={e.stroke}
                fill="none"
              >
                <title>{edgeSentence(e, nodeName)}</title>
              </path>
            ))}
            {vm.nodes.map((n) => {
              const active = selected === n.id
              const dim = selected !== null && !active && !touching(selected).some((e) => e.source === n.id || e.target === n.id)
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className={`node node-${n.kind} ${active ? 'node-active' : ''} ${dim ? 'node-dim' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${n.label}: ${n.valueLabel}`}
                  onClick={() => setSelected(active ? null : n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      setSelected(active ? null : n.id)
                    }
                  }}
                >
                  <rect width={NODE_W} height={NODE_H} rx={9} />
                  <text x={10} y={18} className="node-label">
                    {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                  </text>
                  <text x={10} y={34} className="node-value">
                    {n.valueLabel}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {selectedNode && !tableView && (
        <div className="influence-detail">
          <strong>{selectedNode.label}</strong>
          <p className="muted">{selectedNode.detail}</p>
          <ul>
            {touching(selectedNode.id)
              .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
              .map((e, i) => (
                <li key={i} className={e.weight >= 0 ? 'pos' : 'neg'}>
                  {edgeSentence(e, nodeName)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
