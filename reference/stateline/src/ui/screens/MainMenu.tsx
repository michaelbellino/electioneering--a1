import { useGame } from '@ui/store/gameStore'
import { HOUSE_SPECIAL_PA07 } from '@data/scenarios/houseSpecial'

export function MainMenu() {
  const goTo = useGame((s) => s.goTo)
  return (
    <div className="menu">
      <p className="tagline">
        A deep US political &amp; electoral simulation, grounded in real Census demographics.
      </p>
      <div className="scenario-card">
        <div className="scenario-badge">Scenario</div>
        <h2>{HOUSE_SPECIAL_PA07.title}</h2>
        <p>
          A special election in a genuine tossup district (calibrated to ~50/50). You face a
          better-known, better-funded opponent. Out-campaign them before election day.
        </p>
        <button className="btn btn-primary" onClick={() => goTo('create')}>
          Create your candidate →
        </button>
      </div>
    </div>
  )
}
