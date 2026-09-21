'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type OperatorTotal = {
  operatorId: number
  operatorName: string
  collected: number
  paymentCount: number
  handedOver: number
  received: number
  holding: number
}

type CollectionRow = {
  id: number
  amount: number
  mode: string
  date: string
  operatorId: number | null
  operatorName: string
  customerName: string
  rentalId: number
  machineType: string
}

type TransferRow = {
  id: number
  amount: number
  note: string | null
  date: string
  fromUserId: number
  fromName: string
  toUserId: number
  toName: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export default function OperatorCollections({ userPin, canEdit }: { userPin: string; canEdit: boolean }) {
  const [operators, setOperators] = useState<OperatorTotal[]>([])
  const [payments, setPayments] = useState<CollectionRow[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [selectedId, setSelectedId] = useState<number | 'all'>('all')
  const [fromUserId, setFromUserId] = useState('')
  const [toUserId, setToUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/collections', { headers: { 'x-user-pin': userPin } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load collections')
      setOperators(Array.isArray(data.operators) ? data.operators : [])
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setTransfers(Array.isArray(data.transfers) ? data.transfers : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [userPin])

  const fromRow = useMemo(
    () => operators.find((row) => String(row.operatorId) === fromUserId),
    [fromUserId, operators],
  )
  const visible = selectedId === 'all' ? payments : payments.filter((p) => p.operatorId === selectedId)
  const collectedTotal = operators.reduce((sum, row) => sum + row.collected, 0)
  const holdingTotal = operators.reduce((sum, row) => sum + row.holding, 0)

  async function handover() {
    if (!canEdit) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/payments/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-pin': userPin },
        body: JSON.stringify({
          fromUserId: Number(fromUserId),
          toUserId: Number(toUserId),
          amount: Number(amount),
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Handover failed')
      setAmount('')
      setNote('')
      setMessage('Handover saved. Total money is unchanged.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Handover failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Operator collections</h2>
            <p className="text-xs text-slate-500 mt-1">
              Collected from customers stays on the original operator. Handover only moves who is holding the cash. Old untagged payments are not included.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="px-3 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-1">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {message && <p className="text-sm text-emerald-700 mt-2">{message}</p>}
        <p className="mt-3 text-sm text-slate-600">
          Collected from customers: <span className="font-semibold text-slate-900">{formatCurrency(collectedTotal)}</span>
          {' · '}
          Currently held: <span className="font-semibold text-slate-900">{formatCurrency(holdingTotal)}</span>
        </p>
      </div>

      {canEdit && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-slate-900">Handover to main operator</h3>
          <p className="text-xs text-slate-500 mt-1">Moves cash from one operator to another. Customer payment history does not change.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <label className="text-xs font-semibold text-slate-600">
              From
              <select className="dash-input mt-1 w-full" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
                <option value="">Select operator</option>
                {operators.map((row) => (
                  <option key={row.operatorId} value={row.operatorId}>
                    {row.operatorName} ({formatCurrency(row.holding)} with them)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              To (main)
              <select className="dash-input mt-1 w-full" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
                <option value="">Select operator</option>
                {operators.map((row) => (
                  <option key={row.operatorId} value={row.operatorId}>
                    {row.operatorName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Amount
              <input
                className="dash-input mt-1 w-full"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                placeholder={fromRow ? String(fromRow.holding) : '0'}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Note
              <input className="dash-input mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </label>
          </div>
          <button
            type="button"
            disabled={saving || !fromUserId || !toUserId || !amount}
            onClick={() => void handover()}
            className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Record handover'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {operators.map((row) => (
          <button
            key={row.operatorId}
            type="button"
            onClick={() => setSelectedId(row.operatorId)}
            className={`text-left bg-white rounded-2xl border shadow-sm p-4 ${selectedId === row.operatorId ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
          >
            <p className="text-sm font-semibold text-slate-900">{row.operatorName}</p>
            <p className="text-xs text-slate-500 mt-2">Collected from customers</p>
            <p className="font-semibold text-slate-800">{formatCurrency(row.collected)}</p>
            <p className="text-xs text-slate-500 mt-2">With them now</p>
            <p className="dash-metric text-xl font-semibold text-emerald-700">{formatCurrency(row.holding)}</p>
            <p className="text-[11px] text-slate-500 mt-2">
              Handed over {formatCurrency(row.handedOver)} · Received {formatCurrency(row.received)}
            </p>
          </button>
        ))}
        {operators.length === 0 && !loading && (
          <p className="text-sm text-slate-500 col-span-full">No tagged collections yet. New payments will appear here.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-slate-900">Handover history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">From</th>
                <th className="text-left px-4 py-2">To</th>
                <th className="text-left px-4 py-2">Note</th>
                <th className="text-right px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2">{new Date(row.date).toLocaleString()}</td>
                  <td className="px-4 py-2">{row.fromName}</td>
                  <td className="px-4 py-2">{row.toName}</td>
                  <td className="px-4 py-2">{row.note || '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No handovers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Customer payments (who collected)</h3>
          <button type="button" onClick={() => setSelectedId('all')} className="text-xs font-semibold text-blue-700">
            Show all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Collected by</th>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Mode</th>
                <th className="text-right px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2">{new Date(row.date).toLocaleString()}</td>
                  <td className="px-4 py-2">{row.operatorName}</td>
                  <td className="px-4 py-2">{row.customerName}</td>
                  <td className="px-4 py-2">{row.mode}</td>
                  <td className="px-4 py-2 text-right font-semibold text-emerald-700">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {loading ? 'Loading...' : 'No payments for this view.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
