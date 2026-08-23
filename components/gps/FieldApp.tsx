'use client'

import { useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Search, Share2, Volume2 } from 'lucide-react'
import GpsMap from '@/components/gps/GpsMap'
import { useGpsTracking } from '@/hooks/useGpsTracking'
import { useMeasurementSync } from '@/hooks/useMeasurementSync'
import { FIELD_SESSION_KEY, GPS_ACCURACY_MAX_M, GPS_IDB_FLUSH_MS, GPS_MIN_POINTS_FOR_POLYGON, GUNTHA_PER_ACRE, SYNC_PENDING } from '@/lib/gps/constants'
import { newLocalUuid } from '@/lib/gps/uuid'
import { computeMeasurementGeometry } from '@/lib/gps/area'
import { acreRateForMachine } from '@/lib/prices'
import { idbGetAllMeasurements, idbPutMeasurement, newLocalMeasurement, type LocalMeasurement } from '@/lib/idb/measurements'
import { buildMeasurementShareText, captureMapPng, shareMeasurement } from '@/lib/gps/share'
import { speakMeasuredArea } from '@/lib/gps/speakArea'

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

type Tab = 'home' | 'measure' | 'history'
type MeasurePhase = 'track' | 'review'

const PLACEHOLDER_FARMER = 'GPS मोजणी'
const PLACEHOLDER_PHONE = '0000000000'

function formatArea(n: number) {
  return n.toFixed(2)
}

function formatGuntha(n: number) {
  return n.toFixed(1)
}

function acresToGuntha(acres: number) {
  return acres * GUNTHA_PER_ACRE
}

function gpsStatusLabel(status: string) {
  if (status === 'live') return 'GPS चालू'
  if (status === 'paused') return 'थांबले'
  if (status === 'requesting') return 'GPS शोधत आहे'
  if (status === 'denied') return 'लोकेशन चालू करा'
  if (status === 'weak') return 'सिग्नल कमी'
  if (status === 'unavailable') return 'GPS नाही'
  return 'तयार'
}

export default function FieldApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const gps = useGpsTracking()
  const sync = useMeasurementSync(session.token)
  const [tab, setTab] = useState<Tab>('home')
  const [phase, setPhase] = useState<MeasurePhase>('track')
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [farmerId, setFarmerId] = useState<number | null>(null)
  const [machine, setMachine] = useState(session.machine || 'harvester')
  const [satellite, setSatellite] = useState(false)
  const [draftUuid, setDraftUuid] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [detail, setDetail] = useState<LocalMeasurement | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const selectedFarmer = farmers.find((f) => f.id === farmerId) || null
  const rateN = acreRateForMachine(machine)

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
        setFarmerId(open.customerId > 0 ? open.customerId : null)
        setMachine(open.machine || session.machine || 'harvester')
        setStartedAt(open.startedAt)
        gps.restorePoints(open.points)
        setPhase('track')
        setTab('measure')
        gps.start()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = new Date().toDateString()
  const completed = sync.rows.filter((r) => r.status === 'COMPLETED')
  const todayCount = completed.filter((r) => new Date(r.stoppedAt || r.createdAt).toDateString() === today).length
  const pendingSync = sync.rows.filter((r) => r.status === 'COMPLETED' && r.syncStatus !== 'SYNCED').length
  const totalAcres = completed.reduce((s, r) => s + r.areaAcre, 0)
  const totalGuntha = completed.reduce((s, r) => s + (r.areaGunta || acresToGuntha(r.areaAcre)), 0)

  async function ensureFarmer(): Promise<{ id: number; name: string; village: string }> {
    if (selectedFarmer) {
      return { id: selectedFarmer.id, name: selectedFarmer.name, village: selectedFarmer.address || '' }
    }
    const existing = farmers.find((f) => f.contactNumber === PLACEHOLDER_PHONE || f.name === PLACEHOLDER_FARMER)
    if (existing) {
      return { id: existing.id, name: existing.name, village: existing.address || '' }
    }
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        name: PLACEHOLDER_FARMER,
        contactNumber: PLACEHOLDER_PHONE,
        address: '',
      }),
    })
    const data = await res.json() as Farmer
    if (!res.ok || !data.id) {
      throw new Error('Farmer save failed')
    }
    setFarmers((prev) => [data, ...prev])
    return { id: data.id, name: data.name, village: data.address || '' }
  }

  async function beginTrack() {
    if (draftUuid && phase === 'track') {
      setTab('measure')
      gps.start()
      return
    }
    const uuid = newLocalUuid()
    const now = new Date().toISOString()
    const row = newLocalMeasurement({
      localUuid: uuid,
      fieldOperatorId: session.id,
      customerId: farmerId || 0,
      customerName: selectedFarmer?.name || PLACEHOLDER_FARMER,
      village: selectedFarmer?.address || '',
      machine: machine || session.machine || 'harvester',
      status: 'IN_PROGRESS',
      inProgress: true,
      areaSqm: 0,
      areaAcre: 0,
      areaGunta: 0,
      areaHectare: 0,
      distanceMeters: 0,
      ratePerAcre: rateN,
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
    setTab('measure')
  }

  async function finishTrack() {
    gps.pause()
    gps.publish(true)
    setPhase('review')
  }

  async function saveMeasurement() {
    if (!draftUuid) return
    const geo = computeMeasurementGeometry(gps.pointsRef.current)
    if (gps.pointsRef.current.length < GPS_MIN_POINTS_FOR_POLYGON) return
    const farmer = await ensureFarmer()
    const amount = geo.acres * rateN
    const stoppedAt = new Date().toISOString()
    const row = newLocalMeasurement({
      localUuid: draftUuid,
      fieldOperatorId: session.id,
      customerId: farmer.id,
      customerName: farmer.name,
      village: farmer.village,
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
    setFarmerId(null)
    setShowOptional(false)
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
    setFarmerId(null)
    setShowOptional(false)
    setTab('home')
  }

  async function speakArea(acres: number, guntha: number) {
    setSpeaking(true)
    try {
      await speakMeasuredArea(acres, guntha)
    } finally {
      setSpeaking(false)
    }
  }

  async function shareCurrent(points: LocalMeasurement['points'] | typeof gps.points, extra?: Partial<LocalMeasurement>) {
    setShareError('')
    setSharing(true)
    try {
      const acres = extra?.areaAcre ?? gps.geometry.acres
      const guntha = extra?.areaGunta ?? gps.geometry.guntha
      const text = buildMeasurementShareText({
        farmer: extra?.customerName || selectedFarmer?.name || PLACEHOLDER_FARMER,
        village: extra?.village || selectedFarmer?.address || '',
        machine: extra?.machine || machine,
        operator: session.name,
        acres,
        guntha,
        amount: extra?.amount ?? acres * rateN,
        ratePerAcre: extra?.ratePerAcre ?? rateN,
        dateLabel: extra?.stoppedAt ? new Date(extra.stoppedAt).toLocaleString() : new Date().toLocaleString(),
        points,
      })
      const file = await captureMapPng(document)
      await shareMeasurement({ text, file })
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'पाठवता आले नाही')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden text-gray-900 bg-white pb-28">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4">
        {tab === 'home' && (
          <>
            <div className="glass-panel rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">नमस्कार</p>
                <h1 className="text-xl font-semibold">{session.name}</h1>
              </div>
              <button onClick={onLogout} className="bg-gray-900 text-white px-4 py-3 rounded-xl text-base font-semibold">
                बाहेर पडा
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white p-4 rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-500">आज</p>
                <p className="text-3xl font-bold">{todayCount}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-500">बाकी पाठवा</p>
                <p className="text-3xl font-bold text-amber-700">{pendingSync}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-500">एकर</p>
                <p className="text-3xl font-bold">{formatArea(totalAcres)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-500">गुंठा</p>
                <p className="text-3xl font-bold">{formatGuntha(totalGuntha)}</p>
              </div>
            </div>
            <button
              onClick={beginTrack}
              className="w-full bg-green-500 text-white py-8 rounded-3xl text-3xl font-bold min-h-[88px] shadow-lg"
            >
              मोजणी सुरू करा
            </button>
          </>
        )}

        {tab === 'measure' && phase === 'track' && (
          <div className="space-y-3">
            <div className="h-[48vh]">
              <GpsMap points={gps.points} satellite={satellite} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-center">
                <p className="text-sm text-gray-600">एकर</p>
                <p className="text-3xl font-bold">{formatArea(gps.geometry.acres)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-sm text-gray-600">गुंठा</p>
                <p className="text-3xl font-bold">{formatGuntha(gps.geometry.guntha)}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={speaking}
              onClick={() => speakArea(gps.geometry.acres, gps.geometry.guntha)}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold inline-flex items-center justify-center gap-3 disabled:opacity-70"
            >
              <Volume2 size={28} />
              {speaking ? 'बोलत आहे...' : 'आवाज — एकर / गुंठा'}
            </button>
            <p className="text-center text-lg font-semibold">{gpsStatusLabel(gps.status)}</p>
            {gps.status === 'denied' && <p className="text-center text-red-600 text-lg">फोन सेटिंग मध्ये Location ON करा</p>}
            {gps.lastAccuracy != null && gps.lastAccuracy > GPS_ACCURACY_MAX_M && (
              <p className="text-center text-amber-700">सिग्नल कमी — थोडे थांबा</p>
            )}
            <button onClick={() => setSatellite((s) => !s)} className="w-full py-4 rounded-2xl border text-lg font-semibold">
              {satellite ? 'साधा नकाशा' : 'उपग्रह नकाशा'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              {gps.status === 'paused' ? (
                <button onClick={gps.resume} className="bg-blue-600 text-white py-6 rounded-2xl text-2xl font-bold">पुन्हा चालू</button>
              ) : (
                <button onClick={gps.pause} className="bg-amber-500 text-white py-6 rounded-2xl text-2xl font-bold">थांबा</button>
              )}
              <button onClick={finishTrack} className="bg-slate-900 text-white py-6 rounded-2xl text-2xl font-bold">पूर्ण</button>
            </div>
          </div>
        )}

        {tab === 'measure' && phase === 'review' && (
          <div className="space-y-3">
            <div className="text-center py-2">
              <p className="text-sm text-gray-500">एकूण क्षेत्र</p>
              <p className="text-4xl font-bold">{formatArea(gps.geometry.acres)} एकर</p>
              <p className="text-2xl font-semibold text-amber-800">{formatGuntha(gps.geometry.guntha)} गुंठा</p>
            </div>
            <button
              type="button"
              disabled={speaking}
              onClick={() => speakArea(gps.geometry.acres, gps.geometry.guntha)}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold inline-flex items-center justify-center gap-3 disabled:opacity-70"
            >
              <Volume2 size={28} />
              {speaking ? 'बोलत आहे...' : 'आवाज — एकर / गुंठा'}
            </button>
            <div className="h-56"><GpsMap points={gps.points} satellite={satellite} /></div>
            <button type="button" onClick={() => setSatellite((s) => !s)} className="w-full py-4 rounded-2xl border text-lg font-semibold">
              {satellite ? 'साधा नकाशा' : 'उपग्रह नकाशा'}
            </button>
            {gps.points.length < GPS_MIN_POINTS_FOR_POLYGON && (
              <p className="text-center text-red-600 text-lg">शेताभोवती आणखी चाला</p>
            )}
            <button
              disabled={gps.points.length < GPS_MIN_POINTS_FOR_POLYGON}
              onClick={saveMeasurement}
              className="w-full bg-green-500 text-white py-6 rounded-2xl text-2xl font-bold disabled:bg-gray-300"
            >
              सेव्ह करा
            </button>
            <button
              type="button"
              disabled={sharing || gps.points.length < 1}
              onClick={() => shareCurrent(gps.points)}
              className="w-full bg-green-700 text-white py-5 rounded-2xl text-xl font-bold inline-flex items-center justify-center gap-2 disabled:bg-gray-300"
            >
              <Share2 size={22} /> {sharing ? 'पाठवत आहे...' : 'WhatsApp पाठवा'}
            </button>
            {shareError && <p className="text-red-600 text-center">{shareError}</p>}
            <button onClick={discardMeasurement} className="w-full bg-gray-200 py-4 rounded-2xl text-lg font-semibold">रद्द करा</button>

            <button type="button" onClick={() => setShowOptional((v) => !v)} className="w-full text-gray-500 py-2">
              {showOptional ? '▲ शेतकरी / मशीन लपवा' : '▼ शेतकरी / मशीन (गरज नसेल तर सोडा)'}
            </button>
            {showOptional && (
              <div className="space-y-3 p-3 rounded-2xl border border-dashed">
                <p className="text-sm text-gray-500">हे टाकणे गरजेचे नाही</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'harvester', label: 'हार्वेस्टर' },
                    { id: 'tractor', label: 'ट्रॅक्टर' },
                    { id: 'excavator', label: 'जेसीबी' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMachine(m.id)}
                      className={`py-4 rounded-xl font-semibold ${machine === m.id ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {farmers.slice(0, 20).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFarmerId(f.id)}
                      className={`w-full text-left p-3 rounded-xl border ${farmerId === f.id ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && !detail && (
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">जुनी मोजणी</h2>
            {completed.map((row) => (
              <button key={row.localUuid} onClick={() => setDetail(row)} className="w-full text-left p-4 rounded-2xl border border-gray-200">
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-lg font-semibold">{row.customerName === PLACEHOLDER_FARMER ? 'मोजणी' : row.customerName}</span>
                  <span className="text-right">
                    <span className="block text-xl font-bold text-green-700">{formatArea(row.areaAcre)} एकर</span>
                    <span className="block text-base">{formatGuntha(row.areaGunta || acresToGuntha(row.areaAcre))} गुंठा</span>
                  </span>
                </div>
              </button>
            ))}
            {completed.length === 0 && <p className="text-gray-500 text-lg">अजून मोजणी नाही</p>}
            {pendingSync > 0 && (
              <button onClick={sync.syncPending} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-lg font-semibold inline-flex items-center justify-center gap-2">
                <RefreshCw size={18} /> {sync.syncing ? 'पाठवत आहे...' : 'इंटरनेटवर पाठवा'}
              </button>
            )}
          </div>
        )}

        {tab === 'history' && detail && (
          <div className="space-y-3">
            <button className="text-lg font-semibold" onClick={() => setDetail(null)}>← मागे</button>
            <p className="text-4xl font-bold text-center">{formatArea(detail.areaAcre)} एकर</p>
            <p className="text-2xl text-center">{formatGuntha(detail.areaGunta || acresToGuntha(detail.areaAcre))} गुंठा</p>
            <button
              type="button"
              disabled={speaking}
              onClick={() => speakArea(detail.areaAcre, detail.areaGunta || acresToGuntha(detail.areaAcre))}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold inline-flex items-center justify-center gap-3 disabled:opacity-70"
            >
              <Volume2 size={28} />
              {speaking ? 'बोलत आहे...' : 'आवाज — एकर / गुंठा'}
            </button>
            <div className="h-56"><GpsMap points={detail.points} satellite={satellite} /></div>
            <button type="button" onClick={() => setSatellite((s) => !s)} className="w-full py-4 rounded-2xl border text-lg font-semibold">
              {satellite ? 'साधा नकाशा' : 'उपग्रह नकाशा'}
            </button>
            <button
              type="button"
              disabled={sharing}
              onClick={() => shareCurrent(detail.points, detail)}
              className="w-full bg-green-700 text-white py-5 rounded-2xl text-xl font-bold inline-flex items-center justify-center gap-2"
            >
              <Share2 size={22} /> {sharing ? 'पाठवत आहे...' : 'WhatsApp पाठवा'}
            </button>
            {shareError && <p className="text-red-600 text-center">{shareError}</p>}
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 px-2 pt-2 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto glass-panel rounded-2xl grid grid-cols-3 gap-0 p-1">
          <button
            onClick={() => { setTab('home'); setDetail(null) }}
            className={`flex flex-col items-center py-3 rounded-xl text-sm font-semibold ${tab === 'home' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
          >
            <MapPin size={22} />
            घर
          </button>
          <button
            onClick={() => { beginTrack() }}
            className={`flex flex-col items-center py-3 rounded-xl text-sm font-semibold ${tab === 'measure' ? 'bg-green-50 text-green-700' : 'text-gray-600'}`}
          >
            <Plus size={22} />
            सुरू
          </button>
          <button
            onClick={() => { setTab('history') }}
            className={`flex flex-col items-center py-3 rounded-xl text-sm font-semibold ${tab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
          >
            <Search size={22} />
            जुने
          </button>
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
