import { useMemo, useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { Slider } from '@ui/components/Slider'
import { ISSUE_DEFS } from '@data/voterModel'
import { ISSUE_IDS, type IssueId } from '@data/schema'
import { getDifficulty, attributeCost, totalAttributeCost } from '@data/campaign/difficulties'
import { MAX_TRAITS, TRAITS } from '@data/campaign/traits'
import { getScenario, SCENARIOS } from '@data/scenarios/index'
import type { Party } from '@engine/electorate/types'
import { fmtPosition } from '@ui/format'

const PARTIES: { id: Party; label: string }[] = [
  { id: 'D', label: 'Democrat' },
  { id: 'R', label: 'Republican' },
  { id: 'I', label: 'Independent' },
]

const ATTR_KEYS = ['charisma', 'competence', 'integrity', 'fundraising'] as const
type AttrKey = (typeof ATTR_KEYS)[number]
const ATTR_LABELS: Record<AttrKey, string> = {
  charisma: 'Charisma',
  competence: 'Competence',
  integrity: 'Integrity',
  fundraising: 'Fundraising',
}
const ATTR_HINTS: Record<AttrKey, string> = {
  charisma: 'Rallies, debates, working a hostile room.',
  competence: 'Editorial boards, policy fights, not stepping on rakes.',
  integrity: 'Scandal resistance and the benefit of the doubt.',
  fundraising: 'Donor network — bigger hauls from every fundraiser.',
}

const zeroPositions = (): Record<IssueId, number> =>
  Object.fromEntries(ISSUE_IDS.map((id) => [id, 0])) as Record<IssueId, number>

export function CandidateCreator() {
  const startGame = useGame((s) => s.startGame)
  const goTo = useGame((s) => s.goTo)
  const setup = useGame((s) => s.setup)

  const difficulty = getDifficulty(setup.difficultyId)
  const scenario = getScenario(setup.scenarioId)
  const meta = SCENARIOS.find((s) => s.scenario.id === setup.scenarioId)

  const [name, setName] = useState('Alex Rivera')
  const [party, setParty] = useState<Party>(scenario.player.party)
  const [steps, setSteps] = useState<Record<AttrKey, number>>({
    charisma: 4,
    competence: 4,
    integrity: 4,
    fundraising: 4,
  })
  const [traitIds, setTraitIds] = useState<string[]>([])
  const [positions, setPositions] = useState<Record<IssueId, number>>(zeroPositions)

  const spent = useMemo(() => totalAttributeCost(Object.values(steps)), [steps])
  const budget = difficulty.pointBudget
  const remaining = budget - spent

  const setStep = (k: AttrKey) => (raw: number) => {
    const target = Math.round(raw)
    setSteps((prev) => {
      if (target <= prev[k]) return { ...prev, [k]: Math.max(0, target) }
      // Walk up one step at a time while budget allows.
      let next = prev[k]
      let cost = totalAttributeCost(Object.values(prev))
      while (next < target && next < 10) {
        const stepCost = attributeCost(next + 1) - attributeCost(next)
        if (cost + stepCost > budget) break
        next += 1
        cost += stepCost
      }
      return { ...prev, [k]: next }
    })
  }

  const toggleTrait = (id: string) =>
    setTraitIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < MAX_TRAITS ? [...prev, id] : prev,
    )

  const setPos = (id: IssueId) => (v: number) => setPositions((p) => ({ ...p, [id]: v }))

  const submit = () => {
    startGame(
      {
        name: name.trim() || 'Candidate',
        party,
        attributes: {
          charisma: steps.charisma / 10,
          competence: steps.competence / 10,
          integrity: steps.integrity / 10,
          fundraising: steps.fundraising / 10,
        },
        positions,
      },
      traitIds,
    )
  }

  return (
    <div>
      <div className="page-head">
        <span className="kicker">
          {scenario.title} · {difficulty.label}
          {setup.seed !== null && <> · seed {setup.seed}</>}
        </span>
        <h2>Build your campaign</h2>
        <p className="muted">{meta?.blurb ?? 'Who you are, and where you stand — the electorate will judge both.'}</p>
      </div>
      <div className="creator">
        <div className="panel">
          <h3>
            Your Candidate
            <span className="h3-aside num">
              {remaining} / {budget} pts left
            </span>
          </h3>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Party</span>
            <div className="seg" role="group" aria-label="Party">
              {PARTIES.map((p) => (
                <button
                  key={p.id}
                  className={`seg-btn ${party === p.id ? 'active' : ''} party-${p.id}`}
                  aria-pressed={party === p.id}
                  onClick={() => setParty(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <h4 className="subhead">Attributes — spend your points</h4>
          <div className="budget-bar" aria-hidden="true">
            <div
              className={`budget-fill ${remaining === 0 ? 'maxed' : ''}`}
              style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
            />
          </div>
          {ATTR_KEYS.map((k) => (
            <div key={k} className="attr-row">
              <Slider
                label={ATTR_LABELS[k]}
                value={steps[k]}
                min={0}
                max={10}
                step={1}
                format={(v) => `${Math.round(v)} / 10`}
                onChange={setStep(k)}
              />
              <p className="attr-hint">{ATTR_HINTS[k]}</p>
            </div>
          ))}

          <h4 className="subhead">
            Background <span className="muted">(pick up to {MAX_TRAITS})</span>
          </h4>
          <div className="trait-grid">
            {TRAITS.map((t) => {
              const active = traitIds.includes(t.id)
              const full = !active && traitIds.length >= MAX_TRAITS
              return (
                <button
                  key={t.id}
                  className={`trait-card ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  disabled={full}
                  onClick={() => toggleTrait(t.id)}
                >
                  <strong>{t.label}</strong>
                  <span>{t.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel">
          <h3>Platform</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Where you stand on each issue — drag left toward the conservative pole, right toward the
            progressive pole. Events on the trail can move these later.
          </p>
          {ISSUE_DEFS.map((issue) => (
            <Slider
              key={issue.id}
              label={issue.name}
              value={positions[issue.id]}
              min={-1}
              max={1}
              format={fmtPosition}
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
    </div>
  )
}
