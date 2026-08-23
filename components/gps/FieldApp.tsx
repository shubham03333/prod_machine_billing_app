'use client'

import { useEffect, useMemo, useState } from 'react'
import { LogOut, MapPin, Plus, RefreshCw, Search, User } from 'lucide-react'
import GpsMap from '@/components/gps/GpsMap'
import { useGpsTracking } from '@/hooks/useGpsTracking'
import { useMeasurementSync } from '@/hooks/useMeasurementSync'
import { FIELD_SESSION_KEY, GPS_ACCURACY_MAX_M, GPS_IDB_FLUSH_MS, GPS_MIN_POINTS_FOR_POLYGON, SYNC_PENDING } from '@/lib/gps/constants'
import { newLocalUuid } from '@/lib/gps/uuid'
import { computeMeasurementGeometry } from '@/lib/gps/area'
import { acreRateForMachine } from '@/lib/prices'
import { idbGetAllMeasurements, idbPutMeasurement, newLocalMeasurement, type LocalMeasurement } from '@/lib/idb/measurements'

type Session = {
  type: 'field_operator'
  id: number
  operatorId: string
  name: string
  phone: string
  machine: string
  token: string
}

type Farmer = {
  id: number
  name: string
  contactNumber: string
  address?: string | null
}

type Tab = 'home' | 'measure' | 'history' | 'sync' | 'profile'
type MeasurePhase = 'pick' | 'track' | 'review'

function formatArea(n: number) {
  return n.toFixed(3)
}

export default function FieldApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const gps = useGpsTracking()
  const sync = useMeasurementSync(session.token)
  const [tab, setTab] = useState<Tab>('home')
  const [phase, setPhase] = useState<MeasurePhase>('pick')
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [farmerQuery, setFarmerQuery] = useState('')
  const [farmerId, setFarmerId] = useState<number | null>(null)
  const [machine, setMachine] = useState(session.machine || 'harvester')
  const [satellite, setSatellite] = useState(false)
  const [draftUuid, setDraftUuid] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [rate, setRate] = useState(String(acreRateForMachine(session.machine || 'harvester')))
  const [detail, setDetail] = useState<LocalMeasurement | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [newFarmer, setNewFarmer] = useState({ name: '', contactNumber: '', address: '' })

  const selectedFarmer = farmers.find((f) => f.id === farmerId) || null

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => setFarmers(Array.isArray(data) ? data : []))
      .catch(() => setFarmers([]))
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const flush = async () => {
      if (!draftUuid || gps.status === 'idle') return
      const existing = (await idbGetAllMeasurements()).find((m) => m.localUuid === draftUuid)
      if (!existing) return
      const geo = computeMeasurementGeometry(gps.pointsRef.current)
      await idbPutMeasurement({
        ...existing,
        points: gps.pointsRef.current.slice(),
        areaSqm: geo.squareMeters,
        areaAcre: geo.acres,
        areaGunta: geo.guntha,
        areaHectare: geo.hectares,
        distanceMeters: geo.pathMeters,
        updatedAt: new Date().toISOString(),
        gpsQuality: gps.lastAccuracy != null ? `${gps.lastAccuracy.toFixed(1)}m` : existing.gpsQuality,
      })
    }
    timer = window.setInterval(flush, GPS_IDB_FLUSH_MS)
    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [draftUuid, gps.lastAccuracy, gps.pointsRef, gps.status])

  useEffect(() => {
    idbGetAllMeasurements().then((all) => {
      const open = all.find((m) => m.inProgress && m.fieldOperatorId === session.id)
      if (open) {
        setDraftUuid(open.localUuid)
        setFarmerId(open.customerId)
        setMachine(open.machine)
        setStartedAt(open.startedAt)
        gps.restorePoints(open.points)
        setPhase('track')
        setTab('measure')
        gps.start()
      }
    })
    // restore once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredFarmers = useMemo(() => {
    const q = farmerQuery.toLowerCase()
    return farmers.filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.contactNumber.includes(q) ||
        (f.address || '').toLowerCase().includes(q),
    )
  }, [farmerQuery, farmers])

  const today = new Date().toDateString()
  const completed = sync.rows.filter((r) => r.status === 'COMPLETED')
  const todayCount = completed.filter((r) => new Date(r.stoppedAt || r.createdAt).toDateString() === today).length
  const pendingSync = sync.rows.filter((r) => r.status === 'COMPLETED' && r.syncStatus !== 'SYNCED').length
  const totalAcres = completed.reduce((s, r) => s + r.areaAcre, 0)

  async function beginTrack() {
    if (!selectedFarmer) return
    const uuid = newLocalUuid()
    const now = new Date().toISOString()
    const row = newLocalMeasurement({
      localUuid: uuid,
      fieldOperatorId: session.id,
      customerId: selectedFarmer.id,
      customerName: selectedFarmer.name,
      village: selectedFarmer.address || '',
      machine,
      status: 'IN_PROGRESS',
      inProgress: true,
      areaSqm: 0,
      areaAcre: 0,
      areaGunta: 0,
      areaHectare: 0,
      distanceMeters: 0,
      ratePerAcre: parseFloat(rate) || acreRateForMachine(machine),
      amount: 0,
      gpsQuality: '',
      startedAt: now,
      stoppedAt: null,
      points: [],
    })
    await idbPutMeasurement(row)
    setDraftUuid(uuid)
    setStartedAt(now)
    gps.reset()
    gps.start()
    setPhase('track')
  }

  async function finishTrack() {
    gps.pause()
    gps.publish(true)
    setRate(String(acreRateForMachine(machine)))
    setPhase('review')
  }

  async function saveMeasurement() {
    if (!draftUuid || !selectedFarmer) return
    const geo = computeMeasurementGeometry(gps.pointsRef.current)
    if (gps.pointsRef.current.length < GPS_MIN_POINTS_FOR_POLYGON) return
    const rateN = parseFloat(rate) || 0
    const amount = geo.acres * rateN
    const stoppedAt = new Date().toISOString()
    const row = newLocalMeasurement({
      localUuid: draftUuid,
      fieldOperatorId: session.id,
      customerId: selectedFarmer.id,
      customerName: selectedFarmer.name,
      village: selectedFarmer.address || '',
      machine,
      status: 'COMPLETED',
      inProgress: false,
      syncStatus: SYNC_PENDING,
      areaSqm: geo.squareMeters,
      areaAcre: geo.acres,
      areaGunta: geo.guntha,
      areaHectare: geo.hectares,
      distanceMeters: geo.pathMeters,
      ratePerAcre: rateN,
      amount,
      gpsQuality: gps.lastAccuracy != null ? `${gps.lastAccuracy.toFixed(1)}m` : 'n/a',
      startedAt: startedAt || stoppedAt,
      stoppedAt,
      points: gps.pointsRef.current.slice(),
    })
    await idbPutMeasurement(row)
    gps.reset()
    setDraftUuid(null)
    setPhase('pick')
    setTab('history')
    sync.refresh()
    sync.syncPending()
  }

  async function discardMeasurement() {
    if (draftUuid) {
      const existing = (await idbGetAllMeasurements()).find((m) => m.localUuid === draftUuid)
      if (existing) {
        await idbPutMeasurement({
          ...existing,
          status: 'DISCARDED',
          inProgress: false,
          syncStatus: 'SYNCED',
          updatedAt: new Date().toISOString(),
        })
      }
    }
    gps.reset()
    setDraftUuid(null)
    setPhase('pick')
  }

  async function addFarmer() {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(newFarmer),
    })
    const data = await res.json()
    if (!res.ok) return
    setFarmers((prev) => [data, ...prev])
    setFarmerId(data.id)
    setNewFarmer({ name: '', contactNumber: '', address: '' })
  }

  const history = completed.filter((r) => {
    const q = historyQuery.toLowerCase()
    if (!q) return true
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.village.toLowerCase().includes(q) ||
      r.syncStatus.toLowerCase().includes(q) ||
      r.machine.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden text-gray-900 bg-white pb-28">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4">
        {tab === 'home' && (
          <>
            <div className="glass-panel rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Field operator</p>
                <h1 className="text-xl font-semibold">{session.name}</h1>
                <p className="text-sm text-gray-500">{session.operatorId}</p>
              </div>
              <button onClick={onLogout} className="inline-flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm">
                <LogOut size={15} /> Logout
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Today&apos;s Measurements</p>
                <p className="text-2xl font-semibold">{todayCount}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Pending Sync</p>
                <p className="text-2xl font-semibold text-amber-700">{pendingSync}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Total Acres</p>
                <p className="text-2xl font-semibold">{formatArea(totalAcres)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Machine</p>
                <p className="text-lg font-semibold capitalize">{session.machine}</p>
              </div>
            </div>
            <button
              onClick={() => { setTab('measure'); setPhase('pick') }}
              className="w-full bg-green-500 text-white p-4 rounded-2xl font-semibold min-h-[48px]"
            >
              Start Measurement
            </button>
          </>
        )}

        {tab === 'measure' && phase === 'pick' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Select farmer & machine</h2>
            <input className="glass-input" placeholder="Search farmer, phone, village" value={farmerQuery} onChange={(e) => setFarmerQuery(e.target.value)} />
            <div className="max-h-56 overflow-y-auto space-y-2">
              {filteredFarmers.slice(0, 40).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFarmerId(f.id)}
                  className={`w-full text-left p-3 rounded-xl border ${farmerId === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="font-medium">{f.name}</div>
                  <div className="text-sm text-gray-500">{f.contactNumber} · {f.address || 'No village'}</div>
                </button>
              ))}
            </div>
            <div className="glass-panel rounded-2xl p-4 space-y-2">
              <p className="text-sm font-medium">Add farmer</p>
              <input className="glass-input" placeholder="Name" value={newFarmer.name} onChange={(e) => setNewFarmer({ ...newFarmer, name: e.target.value })} />
              <input className="glass-input" placeholder="Phone" value={newFarmer.contactNumber} onChange={(e) => setNewFarmer({ ...newFarmer, contactNumber: e.target.value })} />
              <input className="glass-input" placeholder="Village / address" value={newFarmer.address} onChange={(e) => setNewFarmer({ ...newFarmer, address: e.target.value })} />
              <button onClick={addFarmer} className="w-full bg-slate-900 text-white p-3 rounded-xl">Save farmer</button>
            </div>
            <select className="glass-input" value={machine} onChange={(e) => setMachine(e.target.value)}>
              <option value="harvester">Harvester</option>
              <option value="tractor">Tractor</option>
              <option value="excavator">JCB</option>
            </select>
            <button
              disabled={!farmerId}
              onClick={beginTrack}
              className="w-full bg-green-500 text-white p-4 rounded-2xl font-semibold disabled:bg-gray-300"
            >
              Continue
            </button>
          </div>
        )}

        {tab === 'measure' && phase === 'track' && (
          <div className="space-y-3">
            <div className="h-[52vh]">
              <GpsMap points={gps.points} satellite={satellite} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 border">Area: {formatArea(gps.geometry.acres)} ac</div>
              <div className="p-3 rounded-xl bg-gray-50 border">Path: {gps.geometry.pathMeters.toFixed(0)} m</div>
              <div className="p-3 rounded-xl bg-gray-50 border">Accuracy: {gps.lastAccuracy != null ? `${gps.lastAccuracy.toFixed(1)} m` : '—'}</div>
              <div className="p-3 rounded-xl bg-gray-50 border capitalize">GPS: {gps.status}</div>
            </div>
            {gps.errorMessage && <p className="text-red-600 text-sm">{gps.errorMessage}</p>}
            {gps.lastAccuracy != null && gps.lastAccuracy > GPS_ACCURACY_MAX_M && (
              <p className="text-amber-700 text-sm">Weak signal — points over {GPS_ACCURACY_MAX_M}m accuracy are ignored.</p>
            )}
            <button onClick={() => setSatellite((s) => !s)} className="w-full py-3 rounded-xl border">{satellite ? 'Map view' : 'Satellite view'}</button>
            <div className="grid grid-cols-2 gap-2">
              {gps.status === 'paused' ? (
                <button onClick={gps.resume} className="bg-blue-600 text-white p-4 rounded-2xl font-semibold">Resume</button>
              ) : (
                <button onClick={gps.pause} className="bg-amber-500 text-white p-4 rounded-2xl font-semibold">Pause</button>
              )}
              <button onClick={finishTrack} className="bg-slate-900 text-white p-4 rounded-2xl font-semibold">Finish</button>
            </div>
          </div>
        )}

        {tab === 'measure' && phase === 'review' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Review measurement</h2>
            <div className="h-64"><GpsMap points={gps.points} satellite={satellite} /></div>
            <div className="space-y-1 text-sm">
              <p>Farmer: {selectedFarmer?.name}</p>
              <p>Village: {selectedFarmer?.address || '—'}</p>
              <p>Machine: {machine}</p>
              <p>Acres: {formatArea(gps.geometry.acres)} · Guntha: {formatArea(gps.geometry.guntha)}</p>
              <p>Hectare: {formatArea(gps.geometry.hectares)} · m²: {gps.geometry.squareMeters.toFixed(0)}</p>
              <p>Points: {gps.points.length}</p>
            </div>
            <label className="text-sm font-medium">Rate per acre</label>
            <input className="glass-input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            <p className="font-semibold">Amount: ₹{((parseFloat(rate) || 0) * gps.geometry.acres).toFixed(2)}</p>
            {gps.points.length < GPS_MIN_POINTS_FOR_POLYGON && <p className="text-red-600 text-sm">Need at least 3 GPS points to save.</p>}
            <button disabled={gps.points.length < GPS_MIN_POINTS_FOR_POLYGON} onClick={saveMeasurement} className="w-full bg-green-500 text-white p-4 rounded-2xl font-semibold disabled:bg-gray-300">Save</button>
            <button onClick={discardMeasurement} className="w-full bg-gray-200 p-4 rounded-2xl font-semibold">Discard</button>
          </div>
        )}

        {tab === 'history' && !detail && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Measurement history</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
              <input className="glass-input pl-9" placeholder="Farmer, village, sync status" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
            </div>
            {history.map((row) => (
              <button key={row.localUuid} onClick={() => setDetail(row)} className="w-full text-left p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between">
                  <span className="font-medium">{row.customerName}</span>
                  <span className="text-green-700">{formatArea(row.areaAcre)} ac</span>
                </div>
                <div className="text-sm text-gray-500">{row.village || '—'} · {row.syncStatus}</div>
              </button>
            ))}
            {history.length === 0 && <p className="text-gray-500 text-sm">No measurements yet.</p>}
          </div>
        )}

        {tab === 'history' && detail && (
          <div className="space-y-3">
            <button className="text-blue-700" onClick={() => setDetail(null)}>← Back</button>
            <div className="h-64"><GpsMap points={detail.points} satellite={satellite} /></div>
            <div className="text-sm space-y-1">
              <p>Farmer: {detail.customerName}</p>
              <p>Village: {detail.village || '—'}</p>
              <p>Machine: {detail.machine}</p>
              <p>Operator: {session.name}</p>
              <p>Area: {formatArea(detail.areaAcre)} ac / {formatArea(detail.areaGunta)} guntha</p>
              <p>Rate: ₹{detail.ratePerAcre} · Amount: ₹{detail.amount.toFixed(2)}</p>
              <p>Date: {new Date(detail.stoppedAt || detail.createdAt).toLocaleString()}</p>
              <p>GPS quality: {detail.gpsQuality}</p>
              <p>Sync: {detail.syncStatus}</p>
            </div>
          </div>
        )}

        {tab === 'sync' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sync status</h2>
            <p className="text-sm">Network: {sync.online ? 'Online' : 'Offline'}</p>
            <button onClick={sync.syncPending} className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white p-3 rounded-xl">
              <RefreshCw size={16} /> {sync.syncing ? 'Syncing...' : 'Sync now'}
            </button>
            {sync.rows.filter((r) => r.status === 'COMPLETED').map((r) => (
              <div key={r.localUuid} className="p-3 rounded-xl border text-sm flex justify-between">
                <span>{r.customerName}</span>
                <span>{r.syncStatus}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <div className="glass-panel rounded-2xl p-4 space-y-2">
            <h2 className="text-lg font-semibold">Profile</h2>
            <p>Name: {session.name}</p>
            <p>Operator ID: {session.operatorId}</p>
            <p>Phone: {session.phone}</p>
            <p>Machine: {session.machine}</p>
            <button onClick={onLogout} className="w-full mt-4 bg-gray-900 text-white p-3 rounded-xl inline-flex items-center justify-center gap-2">
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 px-2 pt-2 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto glass-panel rounded-2xl grid grid-cols-5 gap-0 p-1">
          {[
            { id: 'home' as const, label: 'Home', Icon: MapPin },
            { id: 'measure' as const, label: 'Start', Icon: Plus },
            { id: 'history' as const, label: 'History', Icon: Search },
            { id: 'sync' as const, label: 'Sync', Icon: RefreshCw },
            { id: 'profile' as const, label: 'Profile', Icon: User },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); if (item.id !== 'history') setDetail(null) }}
              className={`flex flex-col items-center py-2.5 rounded-xl text-[11px] ${tab === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
            >
              <item.Icon size={18} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export function loadFieldSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(FIELD_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (parsed.type !== 'field_operator' || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}
