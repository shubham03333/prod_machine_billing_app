'use client'

import { useMemo, useState } from 'react'
import DateAmountBars from '@/components/admin/DateAmountBars'

type ExpensePoint = {
  date: string
  amount: number
  operator?: { name: string }
  dieselCost?: number
  maintenanceCost?: number
  operatorSalary?: number
  driverDrinkCost?: number
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

function expenseCategory(expense: ExpensePoint) {
  if ((expense.dieselCost || 0) > 0) return 'Diesel'
  if ((expense.maintenanceCost || 0) > 0) return 'Maintenance'
  if ((expense.operatorSalary || 0) > 0) return 'Operator Salary'
  if ((expense.driverDrinkCost || 0) > 0) return 'Driver Drink'
  return 'Other'
}

const CATEGORY_COLORS: Record<string, string> = {
  Diesel: 'bg-amber-500',
  Maintenance: 'bg-sky-500',
  'Operator Salary': 'bg-violet-500',
  'Driver Drink': 'bg-pink-500',
  Other: 'bg-slate-500',
}

function BarList({
  rows,
  colorClass,
}: {
  rows: { label: string; amount: number; color?: string }[]
  colorClass: string
}) {
  const max = Math.max(...rows.map((r) => r.amount), 0)
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No expenses in this range.</p>
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0
        return (
          <div key={row.label}>
            <div className="flex justify-between gap-3 text-sm mb-1">
              <span className="text-slate-700 truncate">{row.label}</span>
              <span className="font-medium text-slate-900 whitespace-nowrap">
                {rupee(row.amount)} <span className="text-slate-400 font-normal">({pct}%)</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${row.color || colorClass}`}
                style={{ width: `${max > 0 ? (row.amount / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ExpenseRangeCharts({ expenses }: { expenses: ExpensePoint[] }) {
  const today = localYmd(new Date())
  const [dateFrom, setDateFrom] = useState(() => localYmd(addDays(new Date(), -29)))
  const [dateTo, setDateTo] = useState(today)

  const { points, categoryRows, operatorRows, total, grain } = useMemo(() => {
    const start = parseLocalYmd(dateFrom || today)
    const end = parseLocalYmd(dateTo || today)
    const from = start <= end ? start : end
    const to = start <= end ? end : start
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
    const grain: 'day' | 'month' = spanDays > 62 ? 'month' : 'day'
    const list = Array.isArray(expenses) ? expenses : []

    const inRange = list.filter((expense) => {
      const when = new Date(expense.date)
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

    const categories = new Map<string, number>()
    const operators = new Map<string, number>()
    for (const expense of inRange) {
      const when = new Date(expense.date)
      const key = grain === 'day'
        ? localYmd(when)
        : `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, (buckets.get(key) || 0) + (expense.amount || 0))
      const cat = expenseCategory(expense)
      categories.set(cat, (categories.get(cat) || 0) + (expense.amount || 0))
      const op = expense.operator?.name || 'Unknown'
      operators.set(op, (operators.get(op) || 0) + (expense.amount || 0))
    }

    const points = Array.from(buckets.entries()).map(([key, amount]) => ({
      key,
      amount,
      label: grain === 'day'
        ? `${Number(key.slice(8))} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(key.slice(5, 7)) - 1]}`
        : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`,
    }))

    const categoryRows = ['Diesel', 'Maintenance', 'Operator Salary', 'Driver Drink', 'Other']
      .map((label) => ({ label, amount: categories.get(label) || 0, color: CATEGORY_COLORS[label] }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const operatorRows = Array.from(operators.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)

    const total = inRange.reduce((sum, expense) => sum + (expense.amount || 0), 0)
    return { points, categoryRows, operatorRows, total, grain }
  }, [dateFrom, dateTo, expenses, today])

  const maxPoint = Math.max(...points.map((p) => p.amount), 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Expense graphs</h2>
            <p className="text-sm text-slate-500">Total in range: {rupee(total)}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dash-input" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dash-input" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">1. By date</h3>
        <p className="text-xs text-slate-500 mb-4">{grain === 'month' ? 'Monthly totals' : 'Daily totals'} — taller bar means more spent that day.</p>
        {points.every((p) => p.amount === 0) ? (
          <p className="text-sm text-slate-500 py-6 text-center">No expenses in this date range.</p>
        ) : (
          <DateAmountBars points={points} maxAmount={maxPoint} barClass="bg-rose-500" formatAmount={rupee} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">2. By category</h3>
          <p className="text-xs text-slate-500 mb-4">Share of spend in this date range.</p>
          <BarList rows={categoryRows} colorClass="bg-rose-500" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">3. By operator</h3>
          <p className="text-xs text-slate-500 mb-4">Who recorded the most expense in this range.</p>
          <BarList rows={operatorRows} colorClass="bg-orange-500" />
        </div>
      </div>
    </div>
  )
}
