'use client'

import { useMemo, useState } from 'react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function dayKey(value: string | Date) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return ymd(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function DayFilterCalendar({
  markedDates,
  selectedDate,
  onSelect,
}: {
  markedDates: string[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const selected = selectedDate || ''
  const initial = selected ? new Date(`${selected}T00:00:00`) : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const marked = useMemo(() => new Set(markedDates.filter(Boolean)), [markedDates])

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const items: { day: number | null; key: string }[] = []
    for (let i = 0; i < startPad; i++) items.push({ day: null, key: `pad-${i}` })
    for (let day = 1; day <= daysInMonth; day++) {
      items.push({ day, key: ymd(viewYear, viewMonth, day) })
    }
    return items
  }, [viewMonth, viewYear])

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="hidden lg:block w-[300px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => shiftMonth(-1)} className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-600">
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-900">{MONTHS[viewMonth]} {viewYear}</p>
        <button type="button" onClick={() => shiftMonth(1)} className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-600">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div key={`${day}-${i}`} className="text-center text-[10px] font-semibold text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.day) return <div key={cell.key} className="h-9" />
          const isSelected = selected === cell.key
          const hasRows = marked.has(cell.key)
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.key)}
              className={`h-9 rounded-lg text-sm relative ${
                isSelected
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cell.day}
              {hasRows && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        {selected ? `Showing ${selected.split('-').reverse().join('/')}` : 'Click a date to load that day'}
      </p>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect('')}
          className="mt-2 text-xs font-semibold text-blue-700"
        >
          Show all dates
        </button>
      )}
    </div>
  )
}
