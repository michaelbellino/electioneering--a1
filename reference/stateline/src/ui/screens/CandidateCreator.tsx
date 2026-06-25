import { useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { Slider } from '@ui/components/Slider'
import { ISSUE_DEFS } from '@data/voterModel'
import { ISSUE_IDS, type IssueId } from '@data/schema'
import type { Party } from '@engine/electorate/types'

const PARTIES: { id: Party; label: string }[] = [
  { id: 'D', label: 'Democrat' },
  { id: 'R', label: 'Republican' },
  { id: 'I', label: 'Independent' },
]

const zeroPositions = (): Record<IssueId, number> =>
  Object.fromEntries(ISSUE_IDS.map((id) => [id, 0])) as Record<IssueId, number>

export function CandidateCreator() {
  const startGame = useGame((s) => s.startGame)
  const goTo = useGame((s) => s.goTo)

  const [name, setName] = useState('Alex Rivera')
  const [party, setParty] = useState<Party>('D')
  const [attrs, setAttrs] = useState({ charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 })
  const [positions, setPositions] = useState<Record<IssueId, number>>(zeroPositions)

  const setAttr = (k: keyof typeof attrs) => (v: number) => setAttrs((a) => ({ ...a, [k]: v }))
  const setPos = (id: IssueId) => (v: number) => setPositions((p) => ({ ...p, [id]: v }))

  const submit = () => {
    startGame({ name: name.trim() || 'Candidate', party, attributes: attrs, positions })
  }

  return (
    <div className="creator">
      <div className="panel">
        <h2>Your Candidate</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Party</span>
          <div className="seg">
            {PARTIES.map((p) => (
              <button
                key={p.id}
                className={`seg-btn ${party === p.id ? 'active' : ''} party-${p.id}`}
                onClick={() => setParty(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <h3>Attributes</h3>
        <Slider label="Charisma" value={attrs.charisma} min={0} max={1} onChange={setAttr('charisma')} />
        <Slider label="Competence" value={attrs.competence} min={0} max={1} onChange={setAttr('competence')} />
        <Slider label="Integrity" value={attrs.integrity} min={0} max={1} onChange={setAttr('integrity')} />
        <Slider label="Fundraising" value={attrs.fundraising} min={0} max={1} onChange={setAttr('fundraising')} />
      </div>

      <div className="panel">
        <h3>Platform</h3>
        <p className="muted">Where you stand on each issue. −1 conservative · +1 progressive.</p>
        {ISSUE_DEFS.map((issue) => (
          <Slider
            key={issue.id}
            label={issue.name}
            value={positions[issue.id]}
            min={-1}
            max={1}
            onChange={setPos(issue.id)}
            leftPole={issue.leftPole}
            rightPole={issue.rightPole}
          />
        ))}
        <div className="creator-actions">
          <button className="btn" onClick={() => goTo('menu')}>
            ← Back
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Launch campaign →
          </button>
        </div>
      </div>
    </div>
  )
}
