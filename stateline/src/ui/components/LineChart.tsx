/** A tiny dependency-free SVG line chart for poll history. */
export interface ChartSeries {
  label: string
  color: string
  points: number[]
}

interface LineChartProps {
  series: ChartSeries[]
  height?: number
  yMin?: number
  yMax?: number
  baseline?: number | null
}

export function LineChart({
  series,
  height = 180,
  yMin = 0,
  yMax = 100,
  baseline = 50,
}: LineChartProps) {
  const W = 320
  const H = height
  const n = Math.max(...series.map((s) => s.points.length), 2)
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" preserveAspectRatio="none" role="img">
      {[25, 50, 75].map((g) => (
        <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} className="chart-grid" vectorEffect="non-scaling-stroke" />
      ))}
      {baseline != null && (
        <line x1={0} x2={W} y1={y(baseline)} y2={y(baseline)} className="chart-baseline" vectorEffect="non-scaling-stroke" />
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
