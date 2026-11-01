'use client'

import { useMemo, useState } from 'react'
import DateAmountBars, { ChartMonthSelect, InsightCards, rangeForMonth } from '@/components/admin/DateAmountBars'

type RentalPoint = {
  date: string
  totalAmount: number
  machineType: string
}

function localYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalYmd(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function addDays(d: Date, n: number) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function rupee(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)
}

function machineLabel(type: string) {
  if (type === 'excavator') return 'JCB'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function currentMonthRange() {
  const now = new Date()
  return rangeForMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
}

export default function RevenueRangeCharts({ rentals }: { rentals: RentalPoint[] }) {
  const initial = currentMonthRange()
  const [dateFrom, setDateFrom] = useState(initial.from)
  const [dateTo, setDateTo] = useState(initial.to)

  const { points, machineRows, total, grain } = useMemo(() => {
    const start = parseLocalYmd(dateFrom || initial.from)
    const end = parseLocalYmd(dateTo || initial.to)
    const from = start <= end ? start : end
    const to = start <= end ? end : start
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
    const grain: 'day' | 'month' = spanDays > 62 ? 'month' : 'day'

    const list = Array.isArray(rentals) ? rentals : []
    const inRange = list.filter((rental) => {
      const when = new Date(rental.date)
      if (Number.isNaN(when.getTime())) return false
      const day = localYmd(when)
      return day >= localYmd(from) && day <= localYmd(to)
    })

    const buckets = new Map<string, number>()
    if (grain === 'day') {
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        buckets.set(localYmd(d), 0)
      }
    } else {
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
      const last = new Date(to.getFullYear(), to.getMonth(), 1)
      while (cursor <= last) {
        buckets.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`, 0)
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }

    const machines = new Map<string, number>()
    for (const rental of inRange) {
      const when = new Date(rental.date)
      const key = grain === 'day'
        ? localYmd(when)
        : `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, (buckets.get(key) || 0) + (rental.totalAmount || 0))
      machines.set(rental.machineType, (machines.get(rental.machineType) || 0) + (rental.totalAmount || 0))
    }

    const points = Array.from(buckets.entries()).map(([key, amount]) => ({
      key,
      amount,
      label: grain === 'day'
        ? String(Number(key.slice(8)))
        : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`,
    }))

    const machineRows = Array.from(machines.entries())
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount)

    const total = inRange.reduce((sum, rental) => sum + (rental.totalAmount || 0), 0)
    return { points, machineRows, total, grain }
  }, [dateFrom, dateTo, initial.from, initial.to, rentals])

  const maxPoint = Math.max(...points.map((p) => p.amount), 0)
  const maxMachine = Math.max(...machineRows.map((p) => p.amount), 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">Revenue by date</h2>
          <p className="text-sm text-slate-500">
            {grain === 'month' ? 'Monthly totals' : 'Daily totals'} · {rupee(total)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ChartMonthSelect dateFrom={dateFrom} dateTo={dateTo} onMonth={(from, to) => { setDateFrom(from); setDateTo(to) }} />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dash-input" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dash-input" />
        </div>
      </div>

      {points.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No rental data in this range.</p>
      ) : (
        <DateAmountBars points={points} maxAmount={maxPoint} barClass="bg-emerald-500" lineClass="stroke-emerald-800" formatAmount={rupee} />
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">More insights</h3>
        <InsightCards points={points} total={total} formatAmount={rupee} />
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Revenue by machine</h3>
        {machineRows.length === 0 ? (
          <p className="text-sm text-slate-500">No machine revenue in this range.</p>
        ) : (
          <div className="space-y-2">
            {machineRows.map((row) => (
              <div key={row.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-slate-700">{machineLabel(row.type)}</span>
                  <span className="font-medium text-slate-900">{rupee(row.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${maxMachine > 0 ? (row.amount / maxMachine) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
