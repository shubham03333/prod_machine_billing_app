'use client'

import { useEffect, useState } from 'react'

type FieldOperator = {
  id: number
  operatorId: string
  name: string
  phone: string
  status: string
  machine: string
}

type StaffOperator = {
  id: number
  name: string
}

export default function FieldOperatorsAdmin({
  userPin,
  onStaffOperatorCreated,
}: {
  userPin: string
  onStaffOperatorCreated?: () => void
}) {
  const [rows, setRows] = useState<FieldOperator[]>([])
  const [staffRows, setStaffRows] = useState<StaffOperator[]>([])
  const [error, setError] = useState('')
  const [staffError, setStaffError] = useState('')
  const [staffSuccess, setStaffSuccess] = useState('')
  const [form, setForm] = useState({
    operatorId: '',
    name: '',
    phone: '',
    pin: '',
    machine: 'harvester',
    status: 'ACTIVE',
  })
  const [staffForm, setStaffForm] = useState({ name: '', pin: '' })

  const headers = { 'Content-Type': 'application/json', 'x-user-pin': userPin }

  const load = async () => {
    const res = await fetch('/api/field-operators', { headers: { 'x-user-pin': userPin } })
    const data = await res.json()
    if (res.ok) setRows(Array.isArray(data) ? data : [])
    else setError(data.error || 'Failed to load')
  }

  const loadStaff = async () => {
    const res = await fetch('/api/operators')
    const data = await res.json()
    if (res.ok) setStaffRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    load()
    loadStaff()
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

  async function createStaffOperator() {
    setStaffError('')
    setStaffSuccess('')
    const res = await fetch('/api/operators', {
      method: 'POST',
      headers,
      body: JSON.stringify(staffForm),
    })
    const data = await res.json()
    if (!res.ok) {
      setStaffError(data.error || 'Create failed')
      return
    }
    setStaffForm({ name: '', pin: '' })
    setStaffSuccess(`${data.name} can now log in on the staff screen with their PIN.`)
    loadStaff()
    onStaffOperatorCreated?.()
  }

  async function toggleStatus(row: FieldOperator) {
    const status = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/field-operators/${row.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function deleteStaffOperator(row: StaffOperator) {
    if (!window.confirm(`Delete staff operator ${row.name}? They will no longer be able to log in.`)) return
    setStaffError('')
    setStaffSuccess('')
    const res = await fetch(`/api/operators/${row.id}`, { method: 'DELETE', headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStaffError(data.error || 'Delete failed')
      return
    }
    setStaffSuccess(`${row.name} was deleted.`)
    loadStaff()
    onStaffOperatorCreated?.()
  }

  async function deleteFieldOperator(row: FieldOperator) {
    if (!window.confirm(`Delete field operator ${row.name} (${row.operatorId})? They will no longer be able to log in on /field.`)) return
    setError('')
    const res = await fetch(`/api/field-operators/${row.id}`, { method: 'DELETE', headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Delete failed')
      return
    }
    load()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold mb-1 text-slate-900">Add Field Operator</h2>
          <p className="text-sm text-slate-500 mb-4">Logs in on /field with Operator ID + PIN.</p>
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
          <button onClick={createOperator} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg">Create field operator</button>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold mb-1 text-slate-900">Add Staff Operator</h2>
          <p className="text-sm text-slate-500 mb-4">Normal operator login on the main app with PIN only. Can create rentals and expenses.</p>
          {staffError && <p className="text-red-600 text-sm mb-3">{staffError}</p>}
          {staffSuccess && <p className="text-emerald-700 text-sm mb-3">{staffSuccess}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="dash-input w-full" placeholder="Name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
            <input className="dash-input w-full" placeholder="4 or 6 digit PIN" value={staffForm.pin} onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
          </div>
          <button onClick={createStaffOperator} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg">Create staff operator</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Staff operators</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Name</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Login</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={3}>No staff operators yet.</td>
              </tr>
            ) : (
              staffRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3">{row.name}</td>
                  <td className="px-3 py-3 text-slate-500">Staff PIN</td>
                  <td className="px-3 py-3">
                    <button onClick={() => deleteStaffOperator(row)} className="text-red-600 text-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Field operators</h3>
        </div>
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
                  <button onClick={() => deleteFieldOperator(row)} className="text-red-600 text-sm ml-3">
                    Delete
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
