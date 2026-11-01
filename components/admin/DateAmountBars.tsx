'use client'

import { useMemo, useState } from 'react'

type Point = {
  key: string
  amount: number
  label: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function monthOptions(now = new Date()) {
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    opts.push({ value, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` })
  }
  return opts
}

export function rangeForMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(last)}`,
  }
}

export function monthFromRange(from: string, to: string) {
  if (!from || !to) return 'custom'
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  if (fy !== ty || fm !== tm || fd !== 1) return 'custom'
  const last = new Date(ty, tm, 0).getDate()
  if (td !== last) return 'custom'
  return `${fy}-${pad(fm)}`
}

export function ChartMonthSelect({
  dateFrom,
  dateTo,
  onMonth,
}: {
  dateFrom: string
  dateTo: string
  onMonth: (from: string, to: string) => void
}) {
  const value = monthFromRange(dateFrom, dateTo)
  return (
    <select
      className="dash-input"
      value={value}
      onChange={(e) => {
        const ym = e.target.value
        if (ym === 'custom') return
        const range = rangeForMonth(ym)
        onMonth(range.from, range.to)
      }}
    >
      {value === 'custom' && <option value="custom">Custom range</option>}
      {monthOptions().map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export default function DateAmountBars({
  points,
  maxAmount,
  barClass,
  lineClass = 'stroke-slate-800',
  formatAmount,
}: {
  points: Point[]
  maxAmount: number
  barClass: string
  lineClass?: string
  formatAmount: (amount: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const chartH = 160
  const avg = useMemo(() => {
    if (!points.length) return 0
    return points.reduce((sum, p) => sum + p.amount, 0) / points.length
  }, [points])

  const linePoints = useMemo(() => {
    if (!points.length || maxAmount <= 0) return ''
    return points
      .map((p, i) => {
        const x = ((i + 0.5) / points.length) * 100
        const y = chartH - (p.amount / maxAmount) * (chartH - 8)
        return `${x},${y}`
      })
      .join(' ')
  }, [maxAmount, points])

  const avgY = maxAmount > 0 ? chartH - (avg / maxAmount) * (chartH - 8) : chartH

  return (
    <div className="w-full">
      <div className="relative" style={{ height: chartH }} onMouseLeave={() => setHover(null)}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none">
          {avg > 0 && (
            <line x1="0" y1={avgY} x2="100" y2={avgY} className="stroke-slate-300" strokeWidth="0.4" strokeDasharray="2 1.5" />
          )}
          {linePoints && (
            <polyline
              fill="none"
              points={linePoints}
              className={lineClass}
              strokeWidth="0.7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-end gap-0.5">
          {points.map((point, index) => {
            const height = maxAmount > 0 ? Math.max((point.amount / maxAmount) * (chartH - 8), point.amount > 0 ? 3 : 0) : 0
            return (
              <div
                key={point.key}
                className="relative flex-1 h-full flex items-end justify-center min-w-0"
                onMouseEnter={() => setHover(index)}
              >
                <div
                  className={`w-full max-w-[22px] rounded-t-md ${barClass} ${hover === index ? 'opacity-100' : 'opacity-85'}`}
                  style={{ height: `${height}px` }}
                />
                {hover === index && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md bg-slate-900 text-white text-[11px] px-2 py-1 shadow">
                    {formatAmount(point.amount)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-0.5 mt-1">
        {points.map((point) => (
          <div key={`${point.key}-l`} className="flex-1 min-w-0 text-center text-[9px] leading-none text-slate-600">
            {point.label}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Solid line is daily trend · dashed line is average {formatAmount(avg)}</p>
    </div>
  )
}

export function InsightCards({
  points,
  total,
  formatAmount,
}: {
  points: Point[]
  total: number
  formatAmount: (amount: number) => string
}) {
  const withValue = points.filter((p) => p.amount > 0)
  const peak = withValue.reduce((best, p) => (p.amount > best.amount ? p : best), withValue[0] || { key: '', amount: 0, label: '—' })
  const low = withValue.reduce((best, p) => (p.amount < best.amount ? p : best), withValue[0] || { key: '', amount: 0, label: '—' })
  const avg = points.length ? total / points.length : 0
  const daysActive = withValue.length

  const weekday = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const sums = [0, 0, 0, 0, 0, 0, 0]
    for (const p of points) {
      const d = new Date(`${p.key}T00:00:00`)
      if (Number.isNaN(d.getTime())) continue
      sums[d.getDay()] += p.amount
    }
    const max = Math.max(...sums, 0)
    return names.map((name, i) => ({ name, amount: sums[i], max }))
  }, [points])

  const cumulative = useMemo(() => {
    let run = 0
    return points.map((p) => {
      run += p.amount
      return { ...p, amount: run, label: p.label }
    })
  }, [points])
  const cumMax = Math.max(...cumulative.map((p) => p.amount), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Period total</p>
          <p className="text-sm font-semibold text-slate-900">{formatAmount(total)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Daily average</p>
          <p className="text-sm font-semibold text-slate-900">{formatAmount(avg)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Highest day</p>
          <p className="text-sm font-semibold text-slate-900">{formatAmount(peak.amount)}</p>
          <p className="text-[11px] text-slate-500">{peak.key || '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Active days</p>
          <p className="text-sm font-semibold text-slate-900">{daysActive} / {points.length}</p>
          <p className="text-[11px] text-slate-500">Lowest {formatAmount(low.amount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">By weekday</h4>
          <p className="text-xs text-slate-500 mb-3">Which weekdays bring more in this range.</p>
          <div className="flex items-end gap-2 h-28">
            {weekday.map((row) => (
              <div key={row.name} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full max-w-[28px] rounded-t bg-indigo-500"
                  style={{ height: `${row.max > 0 ? Math.max((row.amount / row.max) * 96, row.amount > 0 ? 4 : 0) : 0}px` }}
                  title={`${row.name}: ${formatAmount(row.amount)}`}
                />
                <span className="text-[10px] text-slate-600 mt-1">{row.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">Running total</h4>
          <p className="text-xs text-slate-500 mb-3">How the period total builds day by day.</p>
          <div className="flex items-end gap-px h-28">
            {cumulative.map((row) => (
              <div
                key={row.key}
                className="flex-1 bg-teal-500/80 rounded-t"
                style={{ height: `${cumMax > 0 ? Math.max((row.amount / cumMax) * 112, row.amount > 0 ? 2 : 0) : 0}px` }}
                title={`${row.key}: ${formatAmount(row.amount)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
