'use client'

import { useEffect, useState } from 'react'

type Row = {
  id: number
  localUuid: string
  machine: string
  areaAcre: number
  amount: number
  syncStatus: string
  stoppedAt: string
  customer: { name: string; address?: string | null }
  fieldOperator: { name: string; operatorId: string }
}

export default function GpsMeasurementsAdmin({ userPin }: { userPin: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/measurements', { headers: { 'x-user-pin': userPin } })
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
  }, [userPin])

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase()
    if (!s) return true
    return (
      r.customer.name.toLowerCase().includes(s) ||
      (r.customer.address || '').toLowerCase().includes(s) ||
      r.fieldOperator.name.toLowerCase().includes(s) ||
      r.syncStatus.toLowerCase().includes(s)
    )
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">GPS Measurements</h2>
        <input className="dash-input w-full sm:w-80" placeholder="Search farmer, village, operator, sync" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Farmer</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Village</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Operator</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Acres</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Amount</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3">{r.customer.name}</td>
                <td className="px-3 py-3">{r.customer.address || '—'}</td>
                <td className="px-3 py-3">{r.fieldOperator.name}</td>
                <td className="px-3 py-3">{r.areaAcre.toFixed(3)}</td>
                <td className="px-3 py-3">₹{r.amount.toFixed(2)}</td>
                <td className="px-3 py-3">{new Date(r.stoppedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
