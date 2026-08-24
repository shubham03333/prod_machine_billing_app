import { GUNTHA_PER_ACRE, SQM_PER_ACRE } from '@/lib/gps/constants'
import { newLocalUuid } from '@/lib/gps/uuid'
import type { CopilotSnapshot, FilteredSample, GeoJsonPolygon } from '@/lib/copilot/types'

const DB_NAME = 'rentra-copilot'
const DB_VERSION = 1
const STORE = 'sessions'

export type LocalCopilotSession = {
  localUuid: string
  cloudId: number | null
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'
  fieldOperatorId: number
  customerId: number | null
  customerName: string
  village: string
  machine: string
  copilotState: string
  areaSqm: number
  areaAcre: number
  areaGunta: number
  distanceMeters: number
  coverageGeoJson: GeoJsonPolygon | null
  harvestPoints: FilteredSample[]
  gpsPoints: FilteredSample[]
  startedAt: string | null
  stoppedAt: string | null
  createdAt: string
  updatedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localUuid' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function idbPutCopilotSession(row: LocalCopilotSession): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(row)
  await waitTx(tx)
}

export async function idbGetCopilotSession(localUuid: string): Promise<LocalCopilotSession | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(localUuid)
    req.onsuccess = () => resolve(req.result as LocalCopilotSession | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAllCopilotSessions(): Promise<LocalCopilotSession[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as LocalCopilotSession[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export function newLocalCopilotSession(input: {
  fieldOperatorId: number
  machine: string
  village: string
  snapshot: CopilotSnapshot
}): LocalCopilotSession {
  const now = new Date().toISOString()
  return {
    localUuid: newLocalUuid(),
    cloudId: null,
    syncStatus: 'PENDING',
    fieldOperatorId: input.fieldOperatorId,
    customerId: null,
    customerName: '',
    village: input.village,
    machine: input.machine,
    copilotState: input.snapshot.state,
    areaSqm: input.snapshot.coverage.areaSqm,
    areaAcre: input.snapshot.coverage.areaSqm / SQM_PER_ACRE,
    areaGunta: (input.snapshot.coverage.areaSqm / SQM_PER_ACRE) * GUNTHA_PER_ACRE,
    distanceMeters: 0,
    coverageGeoJson: input.snapshot.coverage.geoJson,
    harvestPoints: input.snapshot.harvestSamples,
    gpsPoints: input.snapshot.samples,
    startedAt: now,
    stoppedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}
