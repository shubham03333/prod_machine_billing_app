'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyGpsFix } from '@/lib/copilot/engine'
import { BrowserGeolocationProvider } from '@/lib/copilot/gps-provider'
import { DEFAULT_COPILOT_SETTINGS, emptySnapshot, type CopilotSettings, type CopilotSnapshot } from '@/lib/copilot/types'
import {
  idbGetAllCopilotSessions,
  idbPutCopilotSession,
  newLocalCopilotSession,
  type LocalCopilotSession,
} from '@/lib/idb/copilot'
import { SQM_PER_ACRE, GUNTHA_PER_ACRE } from '@/lib/gps/constants'

type SessionInfo = {
  id: number
  machine: string
  token: string
}

export function useCopilotEngine(session: SessionInfo, village: string) {
  const [settings, setSettings] = useState<CopilotSettings>(DEFAULT_COPILOT_SETTINGS)
  const [snapshot, setSnapshot] = useState<CopilotSnapshot>(emptySnapshot())
  const [gpsError, setGpsError] = useState('')
  const [localSession, setLocalSession] = useState<LocalCopilotSession | null>(null)
  const snapRef = useRef(snapshot)
  const settingsRef = useRef(settings)
  const localRef = useRef<LocalCopilotSession | null>(null)
  const providerRef = useRef(new BrowserGeolocationProvider())

  snapRef.current = snapshot
  settingsRef.current = settings
  localRef.current = localSession

  useEffect(() => {
    fetch('/api/copilot/settings', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.effectiveWidthM === 'number') {
          setSettings({ ...DEFAULT_COPILOT_SETTINGS, ...data })
        }
      })
      .catch(() => undefined)
  }, [session.token])

  useEffect(() => {
    const provider = providerRef.current
    provider.start(
      (fix) => {
        const prev = snapRef.current
        const next = applyGpsFix(prev, fix, settingsRef.current)
        snapRef.current = next
        setSnapshot(next)

        const wasActive = prev.sessionActive
        if (next.sessionActive && !wasActive) {
          const row = newLocalCopilotSession({
            fieldOperatorId: session.id,
            machine: session.machine,
            village,
            snapshot: next,
          })
          localRef.current = row
          setLocalSession(row)
          void idbPutCopilotSession(row)
        } else if (localRef.current && (next.sessionActive || next.state === 'HARVEST_COMPLETED')) {
          const acres = next.coverage.areaSqm / SQM_PER_ACRE
          const last = next.samples[next.samples.length - 1]
          const gpsPoints = last
            ? [...(localRef.current.gpsPoints || []), last].slice(-5000)
            : localRef.current.gpsPoints || []
          const updated: LocalCopilotSession = {
            ...localRef.current,
            copilotState: next.state,
            areaSqm: next.coverage.areaSqm,
            areaAcre: acres,
            areaGunta: acres * GUNTHA_PER_ACRE,
            coverageGeoJson: next.coverage.geoJson,
            harvestPoints: next.harvestSamples,
            gpsPoints,
            stoppedAt: next.state === 'HARVEST_COMPLETED' ? new Date().toISOString() : localRef.current.stoppedAt,
            syncStatus: 'PENDING',
            updatedAt: new Date().toISOString(),
          }
          localRef.current = updated
          setLocalSession(updated)
          void idbPutCopilotSession(updated)
        }
      },
      (message) => setGpsError(message),
    )
    return () => provider.stop()
  }, [session.id, session.machine, session.token, village])

  const syncPending = useCallback(async () => {
    const rows = await idbGetAllCopilotSessions()
    for (const row of rows) {
      if (row.syncStatus === 'SYNCED') continue
      if (!row.startedAt) continue
      try {
        await idbPutCopilotSession({ ...row, syncStatus: 'SYNCING', updatedAt: new Date().toISOString() })
        const res = await fetch('/api/copilot/sessions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(row),
        })
        const data = (await res.json()) as { cloudId?: number; error?: string }
        if (!res.ok) throw new Error(data.error || 'sync failed')
        await idbPutCopilotSession({
          ...row,
          cloudId: data.cloudId ?? row.cloudId,
          syncStatus: 'SYNCED',
          updatedAt: new Date().toISOString(),
        })
      } catch {
        await idbPutCopilotSession({ ...row, syncStatus: 'FAILED', updatedAt: new Date().toISOString() })
      }
    }
  }, [session.token])

  useEffect(() => {
    const t = window.setInterval(() => {
      void syncPending()
    }, 20000)
    void syncPending()
    return () => window.clearInterval(t)
  }, [syncPending])

  return { settings, snapshot, gpsError, localSession, syncPending }
}
