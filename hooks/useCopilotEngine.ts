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

const COPILOT_POST_COMPLETE_MS = 6_000

type SessionInfo = {
  id: number
  machine: string
  token: string
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

export function useCopilotEngine(session: SessionInfo, village: string) {
  const [settings, setSettings] = useState<CopilotSettings>(DEFAULT_COPILOT_SETTINGS)
  const [snapshot, setSnapshot] = useState<CopilotSnapshot>(emptySnapshot())
  const [gpsError, setGpsError] = useState('')
  const [localSession, setLocalSession] = useState<LocalCopilotSession | null>(null)
  const [awaitingUpload, setAwaitingUpload] = useState(false)
  const snapRef = useRef(snapshot)
  const settingsRef = useRef(settings)
  const localRef = useRef<LocalCopilotSession | null>(null)
  const providerRef = useRef(new BrowserGeolocationProvider())
  const freezeRef = useRef(false)
  const completeTimerRef = useRef<number | null>(null)

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

  const syncPending = useCallback(async () => {
    if (!isOnline()) return
    const rows = await idbGetAllCopilotSessions()
    for (const row of rows) {
      if (row.syncStatus === 'SYNCED') continue
      if (!row.startedAt || !row.stoppedAt) continue
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
        const synced: LocalCopilotSession = {
          ...row,
          cloudId: data.cloudId ?? row.cloudId,
          syncStatus: 'SYNCED',
          updatedAt: new Date().toISOString(),
        }
        await idbPutCopilotSession(synced)
        if (localRef.current?.localUuid === row.localUuid) {
          localRef.current = synced
          setLocalSession(synced)
        }
      } catch {
        await idbPutCopilotSession({ ...row, syncStatus: 'FAILED', updatedAt: new Date().toISOString() })
      }
    }
  }, [session.token])

  const finalizeAndSync = useCallback(async () => {
    freezeRef.current = true
    setAwaitingUpload(false)
    const row = localRef.current
    if (row) {
      const snap = snapRef.current
      const acres = snap.coverage.areaSqm / SQM_PER_ACRE
      const finalRow: LocalCopilotSession = {
        ...row,
        copilotState: 'HARVEST_COMPLETED',
        areaSqm: snap.coverage.areaSqm,
        areaAcre: acres,
        areaGunta: acres * GUNTHA_PER_ACRE,
        coverageGeoJson: snap.coverage.geoJson,
        harvestPoints: snap.harvestSamples,
        stoppedAt: row.stoppedAt || new Date().toISOString(),
        syncStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
      }
      localRef.current = finalRow
      setLocalSession(finalRow)
      await idbPutCopilotSession(finalRow)
    }
    await syncPending()
  }, [syncPending])

  useEffect(() => {
    const provider = providerRef.current
    provider.start(
      (fix) => {
        const prev = snapRef.current
        let next = applyGpsFix(prev, fix, settingsRef.current)

        if (freezeRef.current && (next.state === 'HARVEST_COMPLETED' || prev.state === 'HARVEST_COMPLETED')) {
          next = {
            ...next,
            harvestSamples: prev.harvestSamples,
            coverage: prev.coverage,
            sessionActive: false,
            state: next.state === 'TRAVELLING' || next.state === 'IDLE' || next.state === 'POSSIBLE_FIELD' ? next.state : 'HARVEST_COMPLETED',
          }
        }

        snapRef.current = next
        setSnapshot(next)

        if (next.state === 'TRAVELLING' && prev.state === 'HARVEST_COMPLETED') {
          freezeRef.current = false
          if (completeTimerRef.current != null) {
            window.clearTimeout(completeTimerRef.current)
            completeTimerRef.current = null
          }
          localRef.current = null
          setLocalSession(null)
          setAwaitingUpload(false)
          return
        }

        const wasActive = prev.sessionActive
        if (next.sessionActive && !wasActive) {
          freezeRef.current = false
          const row = newLocalCopilotSession({
            fieldOperatorId: session.id,
            machine: session.machine,
            village,
            snapshot: next,
          })
          localRef.current = row
          setLocalSession(row)
          void idbPutCopilotSession(row)
        } else if (localRef.current && next.sessionActive) {
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
            stoppedAt: null,
            syncStatus: 'PENDING',
            updatedAt: new Date().toISOString(),
          }
          localRef.current = updated
          setLocalSession(updated)
          void idbPutCopilotSession(updated)
        } else if (localRef.current && next.state === 'HARVEST_COMPLETED' && !freezeRef.current) {
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
            stoppedAt: null,
            syncStatus: 'PENDING',
            updatedAt: new Date().toISOString(),
          }
          localRef.current = updated
          setLocalSession(updated)
          void idbPutCopilotSession(updated)
        }

        if (prev.state !== 'HARVEST_COMPLETED' && next.state === 'HARVEST_COMPLETED' && completeTimerRef.current == null) {
          setAwaitingUpload(true)
          completeTimerRef.current = window.setTimeout(() => {
            completeTimerRef.current = null
            void finalizeAndSync()
          }, COPILOT_POST_COMPLETE_MS)
        }
      },
      (message) => setGpsError(message),
    )
    return () => {
      provider.stop()
      if (completeTimerRef.current != null) window.clearTimeout(completeTimerRef.current)
    }
  }, [finalizeAndSync, session.id, session.machine, session.token, village])

  useEffect(() => {
    const on = () => {
      void syncPending()
    }
    window.addEventListener('online', on)
    const t = window.setInterval(() => {
      if (isOnline()) void syncPending()
    }, 20000)
    void syncPending()
    return () => {
      window.removeEventListener('online', on)
      window.clearInterval(t)
    }
  }, [syncPending])

  return { settings, snapshot, gpsError, localSession, syncPending, awaitingUpload }
}
