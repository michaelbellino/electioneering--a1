import { useGame } from '@ui/store/gameStore'
import { MainMenu } from '@ui/screens/MainMenu'
import { CandidateCreator } from '@ui/screens/CandidateCreator'
import { CampaignDashboard } from '@ui/screens/CampaignDashboard'
import { ElectionNight } from '@ui/screens/ElectionNight'
import { formatDate } from '@engine/core/calendar'

export function App() {
  const screen = useGame((s) => s.screen)
  const state = useGame((s) => s.state)
  const reset = useGame((s) => s.reset)

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={reset}>
          Stateline
        </button>
        {state && (
          <div className="topbar-meta">
            <span>{formatDate(state.calendar.dayIndex)}</span>
            <span className="phase-pill">{state.phase.replace('_', ' ')}</span>
          </div>
        )}
      </header>
      <main>
        {screen === 'menu' && <MainMenu />}
        {screen === 'create' && <CandidateCreator />}
        {screen === 'campaign' && <CampaignDashboard />}
        {screen === 'election' && <ElectionNight />}
      </main>
    </div>
  )
}
