import { useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { Slider } from '@ui/components/Slider'
import { valenceFrom } from '@engine/campaign/profile'
import { ISSUE_DEFS } from '@data/voterModel'
import { ISSUE_IDS, type IssueId } from '@data/schema'
import type { Party } from '@engine/electorate/types'

const PARTIES: { id: Party; label: string; note: string }[] = [
  { id: 'D', label: 'Democrat', note: 'Runs with the Democratic base — the scripted PA-07 opponent is a Republican.' },
  { id: 'R', label: 'Republican', note: 'You run to the right; note the scripted opponent is also a Republican here.' },
  { id: 'I', label: 'Independent', note: 'No party base. Partisanship is the model’s strongest force, so this is hard mode.' },
]

/** What each attribute actually does in the sim — shown under its slider so the choice isn't blind. */
const ATTR_INFO: { key: keyof Attrs; label: string; hint: string }[] = [
  { key: 'charisma', label: 'Charisma', hint: 'Biggest driver of candidate quality (×0.4) — and makes rallies & events land harder.' },
  { key: 'competence', label: 'Competence', hint: 'Second-biggest driver of candidate quality (×0.3).' },
  { key: 'integrity', label: 'Integrity', hint: 'A small quality bump (×0.1) — minor effect in the current slice.' },
  { key: 'fundraising', label: 'Fundraising', hint: 'Boosts fundraiser yields and your passive weekly income (~$200→$1,000/wk).' },
]

type Attrs = { charisma: number; competence: number; integrity: number; fundraising: number }

const zeroPositions = (): Record<IssueId, number> =>
  Object.fromEntries(ISSUE_IDS.map((id) => [id, 0])) as Record<IssueId, number>

export function CandidateCreator() {
  const startGame = useGame((s) => s.startGame)
  const goTo = useGame((s) => s.goTo)

  const [name, setName] = useState('Alex Rivera')
  const [party, setParty] = useState<Party>('D')
  const [attrs, setAttrs] = useState<Attrs>({ charisma: 0.6, competence: 0.6, integrity: 0.6, fundraising: 0.5 })
  const [positions, setPositions] = useState<Record<IssueId, number>>(zeroPositions)

  const setAttr = (k: keyof Attrs) => (v: number) => setAttrs((a) => ({ ...a, [k]: v }))
  const setPos = (id: IssueId) => (v: number) => setPositions((p) => ({ ...p, [id]: v }))

  // Live preview of the exact "quality" (valence) number the electorate will use.
  const quality = Math.round(valenceFrom(attrs) * 100)
  const partyNote = PARTIES.find((p) => p.id === party)?.note ?? ''

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
          <p className="field-hint">{partyNote}</p>
        </div>

        <h3>Attributes</h3>
        <p className="muted">
          These set who you are on day one. Voters can’t judge what they haven’t seen — you start with
          <em> low name recognition</em> and raise it by campaigning.
        </p>
        {ATTR_INFO.map((a) => (
          <Slider
            key={a.key}
            label={a.label}
            value={attrs[a.key]}
            min={0}
            max={1}
            onChange={setAttr(a.key)}
            hint={a.hint}
          />
        ))}

        <div className="creator-readout">
          <div className="readout-row">
            <span>Candidate Quality</span>
            <strong>{quality}<span className="readout-unit">/100</span></strong>
          </div>
          <p className="muted">
            Valence — how voters rate you <em>beyond</em> party &amp; name recognition. Set by Charisma,
            Competence and Integrity. Party loyalty is a stronger force than quality, and no one votes
            for a candidate they’ve never heard of.
          </p>
        </div>
      </div>

      <div className="panel">
        <h3>Platform</h3>
        <p className="muted">
          Where you stand on each issue (−1 conservative · +1 progressive). Voters reward candidates
          <em> close to them</em> — and each demographic group weighs these issues differently, so
          there’s no universally “best” platform.
        </p>
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
