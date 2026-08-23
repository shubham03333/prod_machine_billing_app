import { IDB_NAME, IDB_STORE, IDB_VERSION, SYNC_PENDING } from '@/lib/gps/constants'
import type { GpsSample } from '@/lib/gps/geo'

export type PhotoBlob = {
  id: string
  mimeType: string
  dataUrl: string
}

export type LocalMeasurement = {
  localUuid: string
  cloudId: number | null
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'
  inProgress: boolean
  fieldOperatorId: number
  customerId: number
  customerName: string
  village: string
  machine: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCARDED'
  areaSqm: number
  areaAcre: number
  areaGunta: number
  areaHectare: number
  distanceMeters: number
  ratePerAcre: number
  amount: number
  gpsQuality: string
  startedAt: string
  stoppedAt: string | null
  createdAt: string
  updatedAt: string
  points: GpsSample[]
  photos: PhotoBlob[]
  failCount: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'localUuid' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function idbPutMeasurement(row: LocalMeasurement): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).put(row)
  await txDone(tx)
}

export async function idbGetMeasurement(localUuid: string): Promise<LocalMeasurement | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(localUuid)
    req.onsuccess = () => resolve(req.result as LocalMeasurement | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAllMeasurements(): Promise<LocalMeasurement[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll()
    req.onsuccess = () => resolve((req.result as LocalMeasurement[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export async function idbDeleteMeasurement(localUuid: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).delete(localUuid)
  await txDone(tx)
}

export function newLocalMeasurement(partial: Omit<LocalMeasurement, 'syncStatus' | 'cloudId' | 'photos' | 'failCount' | 'createdAt' | 'updatedAt'> & Partial<LocalMeasurement>): LocalMeasurement {
  const now = new Date().toISOString()
  return {
    photos: [],
    failCount: 0,
    cloudId: null,
    syncStatus: SYNC_PENDING,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}
