'use client'

import { useCallback, useEffect, useState } from 'react'
import { GPS_SYNC_INTERVAL_MS, GPS_SYNC_RETRY_MAX, SYNC_FAILED, SYNC_PENDING, SYNC_SYNCED, SYNC_SYNCING } from '@/lib/gps/constants'
import { idbGetAllMeasurements, idbPutMeasurement, type LocalMeasurement } from '@/lib/idb/measurements'

export function useMeasurementSync(token: string | null) {
  const [rows, setRows] = useState<LocalMeasurement[]>([])
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    const all = await idbGetAllMeasurements()
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    setRows(all)
  }, [])

  const syncOne = useCallback(
    async (row: LocalMeasurement) => {
      if (!token || !online) return row
      if (row.inProgress || row.status !== 'COMPLETED') return row
      if (row.syncStatus === SYNC_SYNCED && row.cloudId) return row
      if (row.failCount >= GPS_SYNC_RETRY_MAX) return row

      const next: LocalMeasurement = { ...row, syncStatus: SYNC_SYNCING, updatedAt: new Date().toISOString() }
      await idbPutMeasurement(next)

      try {
        const res = await fetch('/api/measurements/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            localUuid: row.localUuid,
            customerId: row.customerId,
            machine: row.machine,
            village: row.village,
            status: row.status,
            areaSqm: row.areaSqm,
            areaAcre: row.areaAcre,
            areaGunta: row.areaGunta,
            areaHectare: row.areaHectare,
            distanceMeters: row.distanceMeters,
            ratePerAcre: row.ratePerAcre,
            amount: row.amount,
            gpsQuality: row.gpsQuality,
            startedAt: row.startedAt,
            stoppedAt: row.stoppedAt,
            points: row.points,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Sync failed')
        const synced: LocalMeasurement = {
          ...row,
          cloudId: data.cloudId,
          syncStatus: SYNC_SYNCED,
          failCount: 0,
          updatedAt: new Date().toISOString(),
        }
        await idbPutMeasurement(synced)
        return synced
      } catch {
        const failed: LocalMeasurement = {
          ...row,
          syncStatus: SYNC_FAILED,
          failCount: row.failCount + 1,
          updatedAt: new Date().toISOString(),
        }
        await idbPutMeasurement(failed)
        return failed
      }
    },
    [online, token],
  )

  const syncPending = useCallback(async () => {
    if (!token || !online) return
    setSyncing(true)
    try {
      const all = await idbGetAllMeasurements()
      for (const row of all) {
        if (row.syncStatus === SYNC_PENDING || row.syncStatus === SYNC_FAILED) {
          await syncOne(row)
        }
      }
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [online, refresh, syncOne, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (online) syncPending()
    const t = window.setInterval(() => {
      if (navigator.onLine) syncPending()
    }, GPS_SYNC_INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [online, syncPending])

  return { rows, online, syncing, refresh, syncPending }
}
