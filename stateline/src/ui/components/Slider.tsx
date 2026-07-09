interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  leftPole?: string
  rightPole?: string
}

/** Filled-track background: bipolar ranges (min < 0) fill outward from center, others from left. */
function trackFill(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100
  const track = 'var(--bg-2)'
  const fill = 'rgb(74 163 255 / 0.55)'
  if (min < 0) {
    const [a, b] = pct < 50 ? [pct, 50] : [50, pct]
    return `linear-gradient(to right, ${track} ${a}%, ${fill} ${a}%, ${fill} ${b}%, ${track} ${b}%)`
  }
  return `linear-gradient(to right, ${fill} ${pct}%, ${track} ${pct}%)`
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.05,
  onChange,
  format,
  leftPole,
  rightPole,
}: SliderProps) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-val">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ background: trackFill(value, min, max) }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {(leftPole || rightPole) && (
        <div className="slider-poles">
          <span>{leftPole}</span>
          <span>{rightPole}</span>
        </div>
      )}
    </label>
  )
}
