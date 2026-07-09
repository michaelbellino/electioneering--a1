// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from '@ui/App'
import { useGame } from '@ui/store/gameStore'

afterEach(() => {
  useGame.getState().reset()
  cleanup()
})

describe('playable slice UI', () => {
  it('walks menu → create → campaign and dispatches a real action to the engine', () => {
    render(<App />)

    // Main menu → candidate creator.
    fireEvent.click(screen.getByText(/Create your candidate/i))
    expect(screen.getByText(/Your Candidate/i)).toBeInTheDocument()

    // Launch the campaign with the default candidate.
    fireEvent.click(screen.getByText(/Launch campaign/i))
    expect(screen.getByText(/Campaign Actions/i)).toBeInTheDocument()

    // Clicking an action spends money through the engine (UI is a pure dispatcher).
    const cashBefore = useGame.getState().state!.campaign.finance.cash
    fireEvent.click(screen.getByRole('button', { name: /Positive TV Ad/i }))
    const cashAfter = useGame.getState().state!.campaign.finance.cash
    expect(cashAfter).toBeLessThan(cashBefore)
  })

  it('advancing weeks reaches election night', () => {
    render(<App />)
    fireEvent.click(screen.getByText(/Create your candidate/i))
    fireEvent.click(screen.getByText(/Launch campaign/i))

    // Hammer "Advance week" until the engine reports the election resolved.
    for (let i = 0; i < 40 && useGame.getState().state!.phase === 'campaign'; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Advance week/i }))
    }
    expect(useGame.getState().state!.phase).toBe('election_night')
    expect(screen.getByText(/Results/i)).toBeInTheDocument()
  })
})
