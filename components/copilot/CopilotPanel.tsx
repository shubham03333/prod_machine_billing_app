'use client'

import { useState } from 'react'
import CopilotMap from '@/components/copilot/CopilotMap'
import { useCopilotEngine } from '@/hooks/useCopilotEngine'
import { GUNTHA_PER_ACRE, SQM_PER_ACRE } from '@/lib/gps/constants'
import type { CopilotStateName } from '@/lib/copilot/types'

type Session = {
  id: number
  name: string
  machine: string
  token: string
}

const STATE_LABEL: Record<CopilotStateName, { en: string; mr: string }> = {
  IDLE: { en: 'Idle', mr: 'निष्क्रिय' },
  TRAVELLING: { en: 'Travelling', mr: 'प्रवास' },
  POSSIBLE_FIELD: { en: 'Possible field', mr: 'शेत असू शकते' },
  HARVESTING: { en: 'Harvesting', mr: 'कापणी' },
  POSSIBLE_EXIT: { en: 'Leaving field', mr: 'शेत सोडत आहे' },
  HARVEST_COMPLETED: { en: 'Harvest complete', mr: 'कापणी पूर्ण' },
}

export default function CopilotPanel({
  session,
  lang,
  village,
  onBack,
}: {
  session: Session
  lang: 'mr' | 'en'
  village: string
  onBack: () => void
}) {
  const [satellite, setSatellite] = useState(false)
  const { settings, snapshot, gpsError, localSession, syncPending } = useCopilotEngine(
    { id: session.id, machine: session.machine, token: session.token },
    village,
  )
  const acres = snapshot.coverage.areaSqm / SQM_PER_ACRE
  const guntha = acres * GUNTHA_PER_ACRE
  const remainAcres = snapshot.coverage.remainingSqm / SQM_PER_ACRE
  const mr = lang === 'mr'
  const here = snapshot.samples.length
    ? {
        latitude: snapshot.samples[snapshot.samples.length - 1].latitude,
        longitude: snapshot.samples[snapshot.samples.length - 1].longitude,
        accuracy: snapshot.samples[snapshot.samples.length - 1].accuracy,
        timestamp: snapshot.samples[snapshot.samples.length - 1].timestamp,
      }
    : null

  return (
    <div className="h-full flex flex-col gap-1.5 min-h-0">
      <div className="shrink-0 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm font-semibold">
          ← {mr ? 'मागे' : 'Back'}
        </button>
        <p className="text-xs font-bold px-2 py-1 rounded bg-slate-900 text-white">
          {STATE_LABEL[snapshot.state][lang]}
        </p>
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">
        {mr
          ? 'GPS आपोआप चालू आहे. रस्त्यावर प्रवास आणि शेतातील कापणी वेगळी ओळखली जाते. Start/Stop दाबावे लागत नाही.'
          : 'GPS runs automatically. Travel vs harvest is detected without Start/Stop.'}
      </p>
      <div className="flex-1 min-h-0">
        <CopilotMap here={here} coverage={snapshot.coverage.geoJson} satellite={satellite} />
      </div>
      {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
      <div className="shrink-0 grid grid-cols-2 gap-1.5">
        <div className="py-1.5 rounded-xl bg-green-50 border border-green-200 text-center">
          <p className="text-[10px] text-gray-600">{mr ? 'कापणी एकर' : 'Harvested acre'}</p>
          <p className="text-lg font-bold leading-tight">{acres.toFixed(3)}</p>
        </div>
        <div className="py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
          <p className="text-[10px] text-gray-600">{mr ? 'गुंठा' : 'Guntha'}</p>
          <p className="text-lg font-bold leading-tight">{guntha.toFixed(1)}</p>
        </div>
      </div>
      <div className="shrink-0 grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-lg border py-1">
          <p className="text-gray-500">{mr ? 'अंदाजे बाकी' : 'Est. remaining'}</p>
          <p className="font-semibold">{remainAcres.toFixed(2)} ac</p>
        </div>
        <div className="rounded-lg border py-1">
          <p className="text-gray-500">{mr ? 'वेग' : 'Speed'}</p>
          <p className="font-semibold">{snapshot.speedKmh.toFixed(1)} km/h</p>
        </div>
        <div className="rounded-lg border py-1">
          <p className="text-gray-500">GPS</p>
          <p className="font-semibold">{Math.round(snapshot.accuracyM || 0)} m</p>
        </div>
      </div>
      <p className="text-[10px] text-center text-gray-500">
        {settings.machineName} · {settings.effectiveWidthM.toFixed(2)} m swath · travel {snapshot.travelConfidence.toFixed(2)} · harvest {snapshot.harvestConfidence.toFixed(2)}
        {localSession ? ` · ${localSession.syncStatus}` : ''}
      </p>
      <div className="shrink-0 flex gap-1.5 pb-1">
        <button type="button" onClick={() => setSatellite((s) => !s)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold">
          {satellite ? (mr ? 'नकाशा' : 'Map') : mr ? 'उपग्रह' : 'Satellite'}
        </button>
        <button type="button" onClick={() => void syncPending()} className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold">
          {mr ? 'सिंक' : 'Sync'}
        </button>
      </div>
    </div>
  )
}
