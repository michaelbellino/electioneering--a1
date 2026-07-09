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
  /** Optional one-line explanation of what this slider actually does in the sim. */
  hint?: string
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
  hint,
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
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {(leftPole || rightPole) && (
        <div className="slider-poles">
          <span>{leftPole}</span>
          <span>{rightPole}</span>
        </div>
      )}
      {hint && <div className="slider-hint">{hint}</div>}
    </label>
  )
}
