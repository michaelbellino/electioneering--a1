import { useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { SCENARIOS } from '@data/scenarios/index'
import { DIFFICULTIES } from '@data/campaign/difficulties'
import { dateToDayIndex } from '@engine/core/calendar'
import { fmtUsd } from '@ui/format'

const USD = (d: number) => Math.round(d * 100)

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`difficulty ${n} of 5`}>
      {'★'.repeat(n)}
      <span className="stars-off">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export function MainMenu() {
  const goTo = useGame((s) => s.goTo)
  const setup = useGame((s) => s.setup)
  const configure = useGame((s) => s.configure)
  const [sandboxOpen, setSandboxOpen] = useState(setup.sandbox !== null)

  const selected = SCENARIOS.find((s) => s.scenario.id === setup.scenarioId) ?? SCENARIOS[0]!
  const weeks = Math.round(
    (dateToDayIndex(selected.scenario.electionDate) - dateToDayIndex(selected.scenario.startDate)) / 7,
  )
  const sb = setup.sandbox ?? {}

  const setSandbox = (patch: Partial<typeof sb>) =>
    configure({ sandbox: { ...sb, ...patch } })
  const toggleSandbox = () => {
    if (sandboxOpen) configure({ sandbox: null, seed: null })
    setSandboxOpen(!sandboxOpen)
  }

  return (
    <div className="menu">
      <div className="hero hero-compact">
        <span className="hero-kicker">Political Campaign Simulator · Pre-Alpha</span>
        <h1>Stateline</h1>
        <p className="tagline">
          Pick a race, build a candidate, survive the campaign. Every run is a different story.
        </p>
      </div>

      <div className="setup-grid">
        <section className="setup-section">
          <h3 className="setup-title">Choose your race</h3>
          <div className="scenario-grid" role="radiogroup" aria-label="Scenario">
            {SCENARIOS.map((meta) => {
              const active = meta.scenario.id === setup.scenarioId
              return (
                <button
                  key={meta.scenario.id}
                  role="radio"
                  aria-checked={active}
                  className={`scenario-tile ${active ? 'active' : ''}`}
                  onClick={() => configure({ scenarioId: meta.scenario.id })}
                >
                  <div className="scenario-tile-top">
                    <span className="scenario-tag">{meta.tagline}</span>
                    <Stars n={meta.stars} />
                  </div>
                  <strong>{meta.scenario.title}</strong>
                  <p>{meta.blurb}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="setup-section">
          <h3 className="setup-title">Difficulty</h3>
          <div className="difficulty-row" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => {
              const active = d.id === setup.difficultyId
              return (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={active}
                  className={`difficulty-tile ${active ? 'active' : ''}`}
                  onClick={() => configure({ difficultyId: d.id })}
                >
                  <strong>{d.label}</strong>
                  <p>{d.description}</p>
                  <span className="difficulty-facts num">
                    {d.pointBudget} pts · {d.maxActionPoints} AP · cash ×{d.cashMult}
                  </span>
                </button>
              )
            })}
          </div>

          <button className="sandbox-toggle" aria-expanded={sandboxOpen} onClick={toggleSandbox}>
            {sandboxOpen ? '▾' : '▸'} Sandbox options {sandboxOpen ? '(on — overrides difficulty)' : ''}
          </button>
          {sandboxOpen && (
            <div className="sandbox-panel">
              <label className="sandbox-field">
                <span>Seed <em>(same seed = same story)</em></span>
                <input
                  type="number"
                  placeholder="random"
                  value={setup.seed ?? ''}
                  onChange={(e) =>
                    configure({ seed: e.target.value === '' ? null : Math.abs(parseInt(e.target.value, 10) || 1) })
                  }
                />
              </label>
              <label className="sandbox-field">
                <span>Starting cash: {fmtUsd(sb.startingCash ?? selected.scenario.startingCash)}</span>
                <input
                  type="range"
                  min={USD(10_000)}
                  max={USD(400_000)}
                  step={USD(5_000)}
                  value={sb.startingCash ?? selected.scenario.startingCash}
                  onChange={(e) => setSandbox({ startingCash: parseInt(e.target.value, 10) })}
                />
              </label>
              <label className="sandbox-field">
                <span>Opponent aggression: {Math.round(((sb.opponentIntensity ?? selected.scenario.opponentIntensity) / 1) * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sb.opponentIntensity ?? selected.scenario.opponentIntensity}
                  onChange={(e) => setSandbox({ opponentIntensity: parseFloat(e.target.value) })}
                />
              </label>
              <label className="sandbox-field">
                <span>Race length: {sb.weeks ?? weeks} weeks</span>
                <input
                  type="range"
                  min={6}
                  max={26}
                  step={1}
                  value={sb.weeks ?? weeks}
                  onChange={(e) => setSandbox({ weeks: parseInt(e.target.value, 10) })}
                />
              </label>
              <label className="sandbox-field">
                <span>Action points / week: {sb.maxActionPoints ?? DIFFICULTIES.find((d) => d.id === setup.difficultyId)!.maxActionPoints}</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={sb.maxActionPoints ?? DIFFICULTIES.find((d) => d.id === setup.difficultyId)!.maxActionPoints}
                  onChange={(e) => setSandbox({ maxActionPoints: parseInt(e.target.value, 10) })}
                />
              </label>
            </div>
          )}

          <div className="setup-cta">
            <button className="btn btn-primary btn-lg" onClick={() => goTo('create')}>
              Create your candidate →
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
