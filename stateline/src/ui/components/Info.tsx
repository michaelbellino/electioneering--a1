import type { ReactNode } from 'react'

/**
 * A small, accessible "ⓘ" affordance that reveals a briefing on hover OR keyboard focus.
 * Pure CSS visibility (see .info-wrap in global.css) so it needs no state and never traps focus.
 * Used to surface the sim's hidden mechanics right where the player makes a decision.
 */
export function Info({
  label,
  side = 'top',
  children,
}: {
  label: string
  side?: 'top' | 'bottom'
  children: ReactNode
}) {
  return (
    <span className="info-wrap">
      <button type="button" className="info-dot" aria-label={`What does ${label} do?`}>
        i
      </button>
      <span className={`info-pop info-pop--${side}`} role="tooltip">
        <strong>{label}</strong>
        <span className="info-body">{children}</span>
      </span>
    </span>
  )
}
