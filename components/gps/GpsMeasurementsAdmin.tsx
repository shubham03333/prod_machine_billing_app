'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Save, X } from 'lucide-react'
import { GUNTHA_PER_ACRE } from '@/lib/gps/constants'

type Row = {
  id: number
  localUuid: string
  machine: string
  village?: string | null
  areaAcre: number
  areaGunta: number
  ratePerAcre: number
  amount: number
  approvalStatus?: string
  stoppedAt: string
  customer: { id: number; name: string; address?: string | null }
  fieldOperator: { name: string; operatorId: string }
  rental?: { id: number } | null
}

type Props = {
  userPin: string
  canEdit?: boolean
  onApproved?: () => void
}

function statusOf(row: Row) {
  if (row.rental?.id) return 'APPROVED'
  return String(row.approvalStatus || 'PENDING').toUpperCase()
}

export default function GpsMeasurementsAdmin({ userPin, canEdit = false, onApproved }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customerName: '',
    village: '',
    areaAcre: '',
    areaGunta: '',
    ratePerAcre: '',
    ratePerGuntha: '',
    amount: '',
  })

  const jsonHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', 'x-user-pin': userPin }),
    [userPin],
  )

  const load = useCallback(() => {
    fetch('/api/measurements', { headers: { 'x-user-pin': userPin } })
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
  }, [userPin])

  useEffect(() => {
    load()
  }, [load])

  const selected = rows.find((r) => r.id === selectedId) || null

  useEffect(() => {
    if (!selected) return
    const acres = Number(selected.areaAcre) || 0
    const guntha = Number(selected.areaGunta) || acres * GUNTHA_PER_ACRE
    const rate = Number(selected.ratePerAcre) || 0
    setForm({
      customerName: selected.customer.name || '',
      village: selected.village || selected.customer.address || '',
      areaAcre: acres.toFixed(3),
      areaGunta: guntha.toFixed(2),
      ratePerAcre: rate.toFixed(2),
      ratePerGuntha: (rate / GUNTHA_PER_ACRE).toFixed(2),
      amount: (Number(selected.amount) || acres * rate).toFixed(2),
    })
  }, [selected])

  const visible = rows.filter((r) => {
    if (statusOf(r) !== tab) return false
    const s = query.toLowerCase()
    if (!s) return true
    return (
      r.customer.name.toLowerCase().includes(s) ||
      (r.village || '').toLowerCase().includes(s) ||
      (r.customer.address || '').toLowerCase().includes(s) ||
      r.fieldOperator.name.toLowerCase().includes(s)
    )
  })

  const pendingCount = rows.filter((r) => statusOf(r) === 'PENDING').length

  function recalcAmount(acres: number, rate: number) {
    return (acres * rate).toFixed(2)
  }

  function changeAcres(value: string) {
    const acres = parseFloat(value) || 0
    const rate = parseFloat(form.ratePerAcre) || 0
    setForm((f) => ({
      ...f,
      areaAcre: value,
      areaGunta: (acres * GUNTHA_PER_ACRE).toFixed(2),
      amount: recalcAmount(acres, rate),
    }))
  }

  function changeGuntha(value: string) {
    const guntha = parseFloat(value) || 0
    const acres = guntha / GUNTHA_PER_ACRE
    const rate = parseFloat(form.ratePerAcre) || 0
    setForm((f) => ({
      ...f,
      areaGunta: value,
      areaAcre: acres.toFixed(3),
      amount: recalcAmount(acres, rate),
    }))
  }

  function changeRateAcre(value: string) {
    const rate = parseFloat(value) || 0
    const acres = parseFloat(form.areaAcre) || 0
    setForm((f) => ({
      ...f,
      ratePerAcre: value,
      ratePerGuntha: (rate / GUNTHA_PER_ACRE).toFixed(2),
      amount: recalcAmount(acres, rate),
    }))
  }

  function changeRateGuntha(value: string) {
    const rateG = parseFloat(value) || 0
    const rate = rateG * GUNTHA_PER_ACRE
    const acres = parseFloat(form.areaAcre) || 0
    setForm((f) => ({
      ...f,
      ratePerGuntha: value,
      ratePerAcre: rate.toFixed(2),
      amount: recalcAmount(acres, rate),
    }))
  }

  async function saveCorrections(closePanel = true) {
    if (!selected || !canEdit) return false
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/measurements/${selected.id}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          customerName: form.customerName,
          village: form.village,
          areaAcre: parseFloat(form.areaAcre) || 0,
          areaGunta: parseFloat(form.areaGunta) || 0,
          ratePerAcre: parseFloat(form.ratePerAcre) || 0,
          amount: parseFloat(form.amount) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      load()
      if (closePanel) setSelectedId(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function decide(action: 'approve' | 'reject') {
    if (!selected || !canEdit) return
    if (action === 'approve') {
      const ok = await saveCorrections(false)
      if (!ok) return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/measurements/${selected.id}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      setSelectedId(null)
      load()
      if (action === 'approve') onApproved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const pendingOnly = tab === 'PENDING'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">GPS Field measurements</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fix farmer, village, area and rate here. Overview cards and Recent rentals update only after Approve.
            </p>
          </div>
          <input
            className="dash-input w-full sm:w-72"
            placeholder="Search farmer, village, operator"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="px-4 py-2 flex gap-2 border-b border-slate-100">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id)
                setSelectedId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {id === 'PENDING' ? `Pending${pendingCount ? ` (${pendingCount})` : ''}` : id === 'APPROVED' ? 'Approved' : 'Rejected'}
            </button>
          ))}
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
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`cursor-pointer ${selectedId === r.id ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-3 py-3">{r.customer.name}</td>
                  <td className="px-3 py-3">{r.village || r.customer.address || '—'}</td>
                  <td className="px-3 py-3">{r.fieldOperator.name}</td>
                  <td className="px-3 py-3">{Number(r.areaAcre).toFixed(3)}</td>
                  <td className="px-3 py-3">₹{Number(r.amount).toFixed(2)}</td>
                  <td className="px-3 py-3">{new Date(r.stoppedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500 text-sm">
                    {tab === 'PENDING' ? 'No GPS fields waiting for approval.' : `No ${tab.toLowerCase()} measurements.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">Correct & approve</h3>
              <p className="text-xs text-slate-500">
                Operator: {selected.fieldOperator.name} · {selected.machine}
              </p>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded ${
                statusOf(selected) === 'PENDING'
                  ? 'bg-amber-100 text-amber-800'
                  : statusOf(selected) === 'APPROVED'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {statusOf(selected)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Customer name
              <input className="dash-input mt-1 w-full" value={form.customerName} disabled={!canEdit || !pendingOnly} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Village
              <input className="dash-input mt-1 w-full" value={form.village} disabled={!canEdit || !pendingOnly} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Area (acre)
              <input className="dash-input mt-1 w-full" type="number" step="0.001" value={form.areaAcre} disabled={!canEdit || !pendingOnly} onChange={(e) => changeAcres(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Area (guntha)
              <input className="dash-input mt-1 w-full" type="number" step="0.01" value={form.areaGunta} disabled={!canEdit || !pendingOnly} onChange={(e) => changeGuntha(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Rate / acre
              <input className="dash-input mt-1 w-full" type="number" step="0.01" value={form.ratePerAcre} disabled={!canEdit || !pendingOnly} onChange={(e) => changeRateAcre(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Rate / guntha
              <input className="dash-input mt-1 w-full" type="number" step="0.01" value={form.ratePerGuntha} disabled={!canEdit || !pendingOnly} onChange={(e) => changeRateGuntha(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Amount
              <input className="dash-input mt-1 w-full" type="number" step="0.01" value={form.amount} disabled={!canEdit || !pendingOnly} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {canEdit && pendingOnly && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => saveCorrections()} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">
                <Save size={14} /> {saving ? 'Saving...' : 'Save corrections'}
              </button>
              <button type="button" disabled={saving} onClick={() => decide('approve')} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-60">
                <Check size={14} /> Approve to Overview
              </button>
              <button type="button" disabled={saving} onClick={() => decide('reject')} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white border text-slate-700 text-sm font-semibold disabled:opacity-60">
                <X size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
