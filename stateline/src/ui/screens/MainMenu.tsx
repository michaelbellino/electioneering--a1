import { useGame } from '@ui/store/gameStore'
import { HOUSE_SPECIAL_PA07 } from '@data/scenarios/houseSpecial'
import { dateToDayIndex } from '@engine/core/calendar'
import { fmtUsd } from '@ui/format'

export function MainMenu() {
  const goTo = useGame((s) => s.goTo)
  const scenario = HOUSE_SPECIAL_PA07
  const weeks = Math.round(
    (dateToDayIndex(scenario.electionDate) - dateToDayIndex(scenario.startDate)) / 7,
  )

  return (
    <div className="menu">
      <div className="hero">
        <span className="hero-kicker">Political Campaign Simulator</span>
        <h1>Stateline</h1>
        <p className="tagline">
          Build a candidate, run the race, win the seat — a deep US electoral simulation grounded in
          real Census demographics.
        </p>
      </div>
      <div className="scenario-card">
        <div className="scenario-badge">Scenario</div>
        <h2>{scenario.title}</h2>
        <p>
          A special election in a genuine tossup district (calibrated to ~50/50). You face a
          better-known, better-funded opponent. Out-campaign them before election day.
        </p>
        <ul className="scenario-facts">
          <li>{weeks}-week race</li>
          <li>{fmtUsd(scenario.startingCash)} war chest</li>
          <li>vs. {scenario.opponent.name}</li>
        </ul>
        <button className="btn btn-primary btn-lg" onClick={() => goTo('create')}>
          Create your candidate →
        </button>
      </div>
    </div>
  )
}
