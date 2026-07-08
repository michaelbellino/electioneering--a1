/**
 * Game-feel toolkit: count-up numbers, floating deltas, and the week-advance sweep. UI-only —
 * requestAnimationFrame and timers live here, never in the engine. Everything respects
 * prefers-reduced-motion via the global CSS kill-switch (animations collapse to instant).
 */
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@ui/store/gameStore'
import { fmtUsd } from '@ui/format'

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)

/** Animate a number toward its target (eased). Returns the display value. */
export function useCountUp(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)

  useEffect(() => {
    if (reduceMotion() || fromRef.current === target) {
      fromRef.current = target
      setDisplay(target)
      return
    }
    const from = fromRef.current
    const t0 = performance.now()
    cancelAnimationFrame(rafRef.current)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (target - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}

/** Animated cash readout. */
export function CashValue({ cents }: { cents: number }) {
  const v = useCountUp(cents, 600)
  const falling = v > cents
  return (
    <span className={`stat-value cash-value ${falling ? 'falling' : ''}`}>{fmtUsd(Math.round(v))}</span>
  )
}

interface Floater {
  id: number
  text: string
  kind: 'gain' | 'loss' | 'info'
}

/**
 * Floating deltas: watches the war chest and action points and spawns drifting "+$40,000" /
 * "−1 AP" particles near the top bar whenever they change.
 */
export function FloatingDeltas() {
  const state = useGame((s) => s.state)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const prev = useRef<{ cash: number; ap: number } | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (!state) {
      prev.current = null
      return
    }
    const cash = state.campaign.finance.cash
    const ap = state.campaign.actionPoints
    const before = prev.current
    prev.current = { cash, ap }
    if (!before || reduceMotion()) return

    const spawned: Floater[] = []
    const dCash = cash - before.cash
    if (dCash !== 0 && Math.abs(dCash) > 100) {
      spawned.push({
        id: nextId.current++,
        text: `${dCash > 0 ? '+' : '−'}${fmtUsd(Math.abs(dCash))}`,
        kind: dCash > 0 ? 'gain' : 'loss',
      })
    }
    const dAp = ap - before.ap
    if (dAp < 0) {
      spawned.push({ id: nextId.current++, text: `${dAp} AP`, kind: 'info' })
    }
    if (spawned.length === 0) return
    setFloaters((f) => [...f, ...spawned])
    const ids = spawned.map((s) => s.id)
    const timer = setTimeout(() => setFloaters((f) => f.filter((x) => !ids.includes(x.id))), 1400)
    return () => clearTimeout(timer)
  }, [state])

  if (floaters.length === 0) return null
  return (
    <div className="floaters" aria-hidden="true">
      {floaters.map((f, i) => (
        <span key={f.id} className={`floater floater-${f.kind}`} style={{ animationDelay: `${i * 90}ms` }}>
          {f.text}
        </span>
      ))}
    </div>
  )
}

/** Full-screen sweep when the week advances — the "turn" moment. */
export function WeekSweep() {
  const state = useGame((s) => s.state)
  const [label, setLabel] = useState<string | null>(null)
  const prevDay = useRef<number | null>(null)

  useEffect(() => {
    if (!state) {
      prevDay.current = null
      return
    }
    const day = state.calendar.dayIndex
    if (prevDay.current !== null && day > prevDay.current && state.phase === 'campaign' && !reduceMotion()) {
      const weeksLeft = Math.max(0, Math.round((state.election.electionDay - day) / 7))
      setLabel(weeksLeft === 0 ? 'ELECTION WEEK' : `${weeksLeft} WEEK${weeksLeft === 1 ? '' : 'S'} TO GO`)
      const t = setTimeout(() => setLabel(null), 1100)
      prevDay.current = day
      return () => clearTimeout(t)
    }
    prevDay.current = day
  }, [state])

  if (!label) return null
  return (
    <div className="week-sweep" aria-hidden="true">
      <span>{label}</span>
    </div>
  )
}
