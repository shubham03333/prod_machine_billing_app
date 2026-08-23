'use client'

import { useEffect, useState } from 'react'

type Operator = {
  id: number
  operatorId: string
  name: string
  phone: string
  status: string
  machine: string
}

export default function FieldOperatorsAdmin({ userPin }: { userPin: string }) {
  const [rows, setRows] = useState<Operator[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    operatorId: '',
    name: '',
    phone: '',
    pin: '',
    machine: 'harvester',
    status: 'ACTIVE',
  })

  const headers = { 'Content-Type': 'application/json', 'x-user-pin': userPin }

  const load = async () => {
    const res = await fetch('/api/field-operators', { headers: { 'x-user-pin': userPin } })
    const data = await res.json()
    if (res.ok) setRows(Array.isArray(data) ? data : [])
    else setError(data.error || 'Failed to load')
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPin])

  async function createOperator() {
    setError('')
    const res = await fetch('/api/field-operators', {
      method: 'POST',
      headers,
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Create failed')
      return
    }
    setForm({ operatorId: '', name: '', phone: '', pin: '', machine: 'harvester', status: 'ACTIVE' })
    load()
  }

  async function toggleStatus(row: Operator) {
    const status = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/field-operators/${row.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Add Field Operator</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="dash-input w-full" placeholder="Operator ID (e.g. FO1001)" value={form.operatorId} onChange={(e) => setForm({ ...form, operatorId: e.target.value })} />
          <input className="dash-input w-full" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="dash-input w-full" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="dash-input w-full" placeholder="4 or 6 digit PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
          <select className="dash-input w-full" value={form.machine} onChange={(e) => setForm({ ...form, machine: e.target.value })}>
            <option value="harvester">Harvester</option>
            <option value="tractor">Tractor</option>
            <option value="excavator">JCB</option>
          </select>
        </div>
        <button onClick={createOperator} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg">Create operator</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Operator ID</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Name</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Phone</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Machine</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3">{row.operatorId}</td>
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.phone}</td>
                <td className="px-3 py-3 capitalize">{row.machine}</td>
                <td className="px-3 py-3">{row.status}</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggleStatus(row)} className="text-blue-700 text-sm">
                    {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
