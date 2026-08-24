'use client'

import { useEffect, useState } from 'react'
import type { CopilotSettings } from '@/lib/copilot/types'
import { DEFAULT_COPILOT_SETTINGS } from '@/lib/copilot/types'

export default function CopilotSettingsAdmin({ userPin, canEdit }: { userPin: string; canEdit: boolean }) {
  const [form, setForm] = useState<CopilotSettings>(DEFAULT_COPILOT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/copilot/settings', { headers: { 'x-user-pin': userPin } })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.effectiveWidthM === 'number') {
          setForm({ ...DEFAULT_COPILOT_SETTINGS, ...data })
        }
      })
      .catch(() => undefined)
  }, [userPin])

  async function save() {
    if (!canEdit) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/copilot/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-pin': userPin },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setForm({ ...DEFAULT_COPILOT_SETTINGS, ...data })
      setMessage('Saved')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function num(key: keyof CopilotSettings, label: string, step = 0.1) {
    const value = form[key]
    return (
      <label className="text-xs font-semibold text-slate-600">
        {label}
        <input
          className="dash-input mt-1 w-full"
          type="number"
          step={step}
          disabled={!canEdit}
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
        />
      </label>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold text-slate-900">AI Copilot harvest settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Panesar G60 defaults: 2.60 m cutter, 2.40 m effective swath. These change detection only — boundary measurement is unchanged.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            Machine name
            <input className="dash-input mt-1 w-full" disabled={!canEdit} value={form.machineName} onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))} />
          </label>
          {num('cutterWidthM', 'Cutter width (m)')}
          {num('effectiveWidthM', 'Effective swath (m)')}
          {num('minHarvestKmh', 'Min harvest speed (km/h)')}
          {num('maxHarvestKmh', 'Max harvest speed (km/h)')}
          {num('travelSpeedKmh', 'Travel speed threshold (km/h)')}
          {num('minGpsAccuracyM', 'Max GPS accuracy (m)')}
          {num('minMoveM', 'Min move (m)')}
          {num('maxJumpM', 'Max jump (m)')}
          {num('maxSpeedMps', 'Max speed (m/s)')}
          {num('parallelPassToleranceM', 'Parallel pass tolerance (m)')}
          {num('headingTurnMinDeg', 'U-turn min (deg)', 1)}
          {num('headingTurnMaxDeg', 'U-turn max (deg)', 1)}
          {num('autoStopDelayMs', 'Auto-stop delay (ms)', 1000)}
          {num('travelConfidenceThreshold', 'Travel confidence', 0.01)}
          {num('harvestConfidenceThreshold', 'Harvest confidence', 0.01)}
          {num('possibleFieldHoldMs', 'Possible-field hold (ms)', 500)}
        </div>
        {message && <p className="text-sm mt-3">{message}</p>}
        {canEdit && (
          <button type="button" disabled={saving} onClick={() => void save()} className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Copilot settings'}
          </button>
        )}
      </div>
    </div>
  )
}
