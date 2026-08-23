'use client'

import { useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Search, Share2, Volume2 } from 'lucide-react'
import GpsMap from '@/components/gps/GpsMap'
import { useGpsTracking } from '@/hooks/useGpsTracking'
import { useMeasurementSync } from '@/hooks/useMeasurementSync'
import {
  FIELD_SESSION_KEY,
  GPS_IDB_FLUSH_MS,
  GPS_MIN_POINTS_FOR_POLYGON,
  GPS_WARN_ACCURACY_M,
  GUNTHA_PER_ACRE,
  SYNC_PENDING,
} from '@/lib/gps/constants'
import { newLocalUuid } from '@/lib/gps/uuid'
import { computeMeasurementGeometry } from '@/lib/gps/area'
import { acreRateForMachine } from '@/lib/prices'
import {
  idbGetAllMeasurements,
  idbPutMeasurement,
  newLocalMeasurement,
  type LocalMeasurement,
} from '@/lib/idb/measurements'
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
type Lang = 'mr' | 'en'

const LANG_KEY = 'fieldUiLang'
const PLACEHOLDER_MR = 'GPS मोजणी'
const PLACEHOLDER_EN = 'GPS measurement'
const PLACEHOLDER_PHONE = '0000000000'

const I18N = {
  mr: {
    hello: 'नमस्कार',
    logout: 'बाहेर',
    today: 'आज',
    pending: 'बाकी पाठवा',
    acre: 'एकर',
    guntha: 'गुंठा',
    start: 'मोजणी सुरू करा',
    startHint: 'शेतात उभे राहा आणि सुरू दाबा',
    https: 'GPS साठी HTTPS वापरा. http:// IP वर लोकेशन चालत नाही.',
    denied: 'लोकेशन बंद आहे',
    noGps: 'GPS मिळाले नाही',
    searching: 'GPS शोधत आहे',
    deniedHint: 'Chrome मध्ये Location Allow करा',
    httpHint: 'साइट HTTPS ने उघडा. बाहेर उभे रहा.',
    searchHint: 'फोन बाहेर ठेवा, आकाश दिसेल तिथे',
    speak: 'आवाज',
    speaking: 'बोलत आहे...',
    locOn: 'फोन Location ON करा',
    signal: 'सिग्नल सुधारत आहे',
    map: 'नकाशा',
    sat: 'उपग्रह',
    resume: 'चालू',
    stop: 'थांबा',
    complete: 'पूर्ण',
    total: 'एकूण क्षेत्र',
    walk: 'शेताभोवती आणखी चाला',
    save: 'सेव्ह',
    wa: 'WhatsApp',
    sending: 'पाठवत आहे...',
    cancel: 'रद्द',
    hideFarmer: 'शेतकरी लपवा',
    showFarmer: 'शेतकरी / मशीन',
    skip: 'गरज नसेल तर सोडा',
    old: 'जुनी मोजणी',
    item: 'मोजणी',
    none: 'अजून मोजणी नाही',
    sync: 'इंटरनेटवर पाठवा',
    back: 'मागे',
    navHome: 'घर',
    navStart: 'सुरू',
    navOld: 'जुने',
    live: 'GPS चालू',
    paused: 'थांबले',
    req: 'GPS शोधत आहे',
    deniedSt: 'लोकेशन चालू करा',
    weak: 'सिग्नल कमी',
    noneGps: 'GPS नाही',
    ready: 'तयार',
    shareFail: 'पाठवता आले नाही',
    harv: 'हार्वेस्टर',
    trac: 'ट्रॅक्टर',
    excav: 'जेसीबी',
  },
  en: {
    hello: 'Hello',
    logout: 'Logout',
    today: 'Today',
    pending: 'To sync',
    acre: 'Acre',
    guntha: 'Guntha',
    start: 'Start measure',
    startHint: 'Stand in the field, then press Start',
    https: 'Use HTTPS for GPS. Location will not work on http:// IP.',
    denied: 'Location is off',
    noGps: 'GPS not found',
    searching: 'Finding GPS',
    deniedHint: 'Allow Location in Chrome',
    httpHint: 'Open the site with HTTPS. Stand outside.',
    searchHint: 'Keep the phone outside under open sky',
    speak: 'Speak',
    speaking: 'Speaking...',
    locOn: 'Turn phone Location ON',
    signal: 'Signal is improving',
    map: 'Map',
    sat: 'Satellite',
    resume: 'Resume',
    stop: 'Stop',
    complete: 'Complete',
    total: 'Total area',
    walk: 'Walk more around the field',
    save: 'Save',
    wa: 'WhatsApp',
    sending: 'Sending...',
    cancel: 'Cancel',
    hideFarmer: 'Hide farmer',
    showFarmer: 'Farmer / machine',
    skip: 'Skip if not needed',
    old: 'Old measurements',
    item: 'Measurement',
    none: 'No measurements yet',
    sync: 'Send to internet',
    back: 'Back',
    navHome: 'Home',
    navStart: 'Start',
    navOld: 'Old',
    live: 'GPS on',
    paused: 'Paused',
    req: 'Finding GPS',
    deniedSt: 'Turn location on',
    weak: 'Weak signal',
    noneGps: 'No GPS',
    ready: 'Ready',
    shareFail: 'Could not send',
    harv: 'Harvester',
    trac: 'Tractor',
    excav: 'JCB',
  },
}

function fmtAcre(n: number) {
  return n.toFixed(2)
}

function fmtGuntha(n: number) {
  return n.toFixed(1)
}

function toGuntha(acres: number) {
  return acres * GUNTHA_PER_ACRE
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (v: Lang) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs font-bold">
      <button type="button" onClick={() => onChange('mr')} className={`px-2.5 py-1 ${lang === 'mr' ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>
        मराठी
      </button>
      <button type="button" onClick={() => onChange('en')} className={`px-2.5 py-1 ${lang === 'en' ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>
        EN
      </button>
    </div>
  )
}

export default function FieldApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const gps = useGpsTracking()
  const sync = useMeasurementSync(session.token)
  const [tab, setTab] = useState<Tab>('measure')
  const [phase, setPhase] = useState<MeasurePhase>('track')
  const [lang, setLang] = useState<Lang>('mr')
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
  const [secureContext, setSecureContext] = useState(true)

  const tx = I18N[lang]
  const placeholder = lang === 'en' ? PLACEHOLDER_EN : PLACEHOLDER_MR
  const selectedFarmer = farmers.find((f) => f.id === farmerId) || null
  const rate = acreRateForMachine(machine)
  const tracking = Boolean(draftUuid) && phase === 'track'
  const btn = 'rounded-xl text-sm font-semibold py-2.5 px-3'

  useEffect(() => {
    setSecureContext(window.isSecureContext)
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'mr') setLang(saved)
  }, [])

  function changeLang(next: Lang) {
    setLang(next)
    localStorage.setItem(LANG_KEY, next)
  }

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => setFarmers(Array.isArray(data) ? data : []))
      .catch(() => setFarmers([]))
  }, [])

  useEffect(() => {
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
    const timer = window.setInterval(flush, GPS_IDB_FLUSH_MS)
    return () => window.clearInterval(timer)
  }, [draftUuid, gps.lastAccuracy, gps.pointsRef, gps.status])

  useEffect(() => {
    idbGetAllMeasurements().then((all) => {
      const open = all.find((m) => m.inProgress && m.fieldOperatorId === session.id)
      if (!open) return
      setDraftUuid(open.localUuid)
      setFarmerId(open.customerId > 0 ? open.customerId : null)
      setMachine(open.machine || session.machine || 'harvester')
      setStartedAt(open.startedAt)
      gps.restorePoints(open.points)
      setPhase('track')
      setTab('measure')
      gps.start()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = new Date().toDateString()
  const completed = sync.rows.filter((r) => r.status === 'COMPLETED')
  const todayCount = completed.filter((r) => new Date(r.stoppedAt || r.createdAt).toDateString() === today).length
  const pendingSync = completed.filter((r) => r.syncStatus !== 'SYNCED').length
  const totalAcres = completed.reduce((s, r) => s + r.areaAcre, 0)
  const totalGuntha = completed.reduce((s, r) => s + (r.areaGunta || toGuntha(r.areaAcre)), 0)

  function statusLabel(status: string) {
    if (status === 'live') return tx.live
    if (status === 'paused') return tx.paused
    if (status === 'requesting') return tx.req
    if (status === 'denied') return tx.deniedSt
    if (status === 'weak') return tx.weak
    if (status === 'unavailable') return tx.noneGps
    return tx.ready
  }

  async function ensureFarmer() {
    if (selectedFarmer) {
      return { id: selectedFarmer.id, name: selectedFarmer.name, village: selectedFarmer.address || '' }
    }
    const existing = farmers.find(
      (f) => f.contactNumber === PLACEHOLDER_PHONE || f.name === PLACEHOLDER_MR || f.name === PLACEHOLDER_EN,
    )
    if (existing) {
      return { id: existing.id, name: existing.name, village: existing.address || '' }
    }
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ name: placeholder, contactNumber: PLACEHOLDER_PHONE, address: '' }),
    })
    const data = (await res.json()) as Farmer
    if (!res.ok || !data.id) throw new Error('Farmer save failed')
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
    await idbPutMeasurement(
      newLocalMeasurement({
        localUuid: uuid,
        fieldOperatorId: session.id,
        customerId: farmerId || 0,
        customerName: selectedFarmer?.name || placeholder,
        village: selectedFarmer?.address || '',
        machine: machine || session.machine || 'harvester',
        status: 'IN_PROGRESS',
        inProgress: true,
        areaSqm: 0,
        areaAcre: 0,
        areaGunta: 0,
        areaHectare: 0,
        distanceMeters: 0,
        ratePerAcre: rate,
        amount: 0,
        gpsQuality: '',
        startedAt: now,
        stoppedAt: null,
        points: [],
      }),
    )
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
    if (gps.pointsRef.current.length < GPS_MIN_POINTS_FOR_POLYGON) return
    const geo = computeMeasurementGeometry(gps.pointsRef.current)
    const farmer = await ensureFarmer()
    const stoppedAt = new Date().toISOString()
    await idbPutMeasurement(
      newLocalMeasurement({
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
        ratePerAcre: rate,
        amount: geo.acres * rate,
        gpsQuality: gps.lastAccuracy != null ? `${gps.lastAccuracy.toFixed(1)}m` : 'n/a',
        startedAt: startedAt || stoppedAt,
        stoppedAt,
        points: gps.pointsRef.current.slice(),
      }),
    )
    gps.reset()
    setDraftUuid(null)
    setFarmerId(null)
    setShowOptional(false)
    setPhase('track')
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
    setPhase('track')
    setTab('measure')
  }

  async function speakNow(acres: number, guntha: number) {
    setSpeaking(true)
    try {
      await speakMeasuredArea(acres, guntha, lang)
    } finally {
      setSpeaking(false)
    }
  }

  async function shareNow(points: LocalMeasurement['points'] | typeof gps.points, extra?: Partial<LocalMeasurement>) {
    setShareError('')
    setSharing(true)
    try {
      const acres = extra?.areaAcre ?? gps.geometry.acres
      const guntha = extra?.areaGunta ?? gps.geometry.guntha
      const text = buildMeasurementShareText({
        farmer: extra?.customerName || selectedFarmer?.name || placeholder,
        village: extra?.village || selectedFarmer?.address || '',
        machine: extra?.machine || machine,
        operator: session.name,
        acres,
        guntha,
        amount: extra?.amount ?? acres * rate,
        ratePerAcre: extra?.ratePerAcre ?? rate,
        dateLabel: extra?.stoppedAt ? new Date(extra.stoppedAt).toLocaleString() : new Date().toLocaleString(),
        points,
      })
      const file = await captureMapPng(document)
      await shareMeasurement({ text, file })
    } catch (err) {
      setShareError(err instanceof Error ? err.message : tx.shareFail)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-white text-gray-900 flex flex-col">
      <header className="shrink-0 max-w-2xl w-full mx-auto px-3 pt-2 pb-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 leading-none">{tx.hello}</p>
          <h1 className="text-sm font-semibold truncate">{session.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LangToggle lang={lang} onChange={changeLang} />
          <button onClick={onLogout} className="bg-gray-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold">
            {tx.logout}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-2xl w-full mx-auto px-3 overflow-hidden">
        {tab === 'home' && (
          <div className="h-full overflow-y-auto pb-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border"><p className="text-xs text-gray-500">{tx.today}</p><p className="text-2xl font-bold">{todayCount}</p></div>
              <div className="p-3 rounded-xl border"><p className="text-xs text-gray-500">{tx.pending}</p><p className="text-2xl font-bold text-amber-700">{pendingSync}</p></div>
              <div className="p-3 rounded-xl border"><p className="text-xs text-gray-500">{tx.acre}</p><p className="text-2xl font-bold">{fmtAcre(totalAcres)}</p></div>
              <div className="p-3 rounded-xl border"><p className="text-xs text-gray-500">{tx.guntha}</p><p className="text-2xl font-bold">{fmtGuntha(totalGuntha)}</p></div>
            </div>
            {!secureContext && <p className="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">{tx.https}</p>}
            <button onClick={beginTrack} className={`mt-3 w-full bg-green-500 text-white ${btn}`}>{tx.start}</button>
          </div>
        )}

        {tab === 'measure' && phase === 'track' && !tracking && (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            {!secureContext && <p className="mb-3 p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">{tx.https}</p>}
            <p className="text-sm text-gray-600 mb-3">{tx.startHint}</p>
            <button onClick={beginTrack} className={`w-full max-w-sm bg-green-500 text-white ${btn} text-base shadow`}>{tx.start}</button>
          </div>
        )}

        {tab === 'measure' && phase === 'track' && tracking && (
          <div className="h-full flex flex-col gap-1.5 min-h-0">
            <div className="flex-1 min-h-0">
              {!gps.here ? (
                <div className="h-full flex items-center justify-center rounded-xl border bg-slate-50 px-4 text-center">
                  <div>
                    <p className="text-base font-bold mb-1">{gps.status === 'denied' ? tx.denied : gps.status === 'unavailable' ? tx.noGps : tx.searching}</p>
                    <p className="text-xs text-gray-600">{gps.status === 'denied' ? tx.deniedHint : gps.status === 'unavailable' ? tx.httpHint : tx.searchHint}</p>
                  </div>
                </div>
              ) : (
                <GpsMap points={gps.points} here={gps.here} satellite={satellite} />
              )}
            </div>
            <div className="shrink-0 grid grid-cols-2 gap-1.5">
              <div className="py-1.5 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-[10px] text-gray-600 leading-none">{tx.acre}</p>
                <p className="text-lg font-bold leading-tight">{fmtAcre(gps.geometry.acres)}</p>
              </div>
              <div className="py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-[10px] text-gray-600 leading-none">{tx.guntha}</p>
                <p className="text-lg font-bold leading-tight">{fmtGuntha(gps.geometry.guntha)}</p>
              </div>
            </div>
            <div className="shrink-0 flex gap-1.5">
              <button type="button" disabled={speaking} onClick={() => speakNow(gps.geometry.acres, gps.geometry.guntha)} className={`flex-1 bg-blue-600 text-white ${btn} inline-flex items-center justify-center gap-1 disabled:opacity-70`}>
                <Volume2 size={16} /> {speaking ? tx.speaking : tx.speak}
              </button>
              <button onClick={() => setSatellite((s) => !s)} className={`flex-1 border ${btn}`}>{satellite ? tx.map : tx.sat}</button>
            </div>
            <p className="shrink-0 text-center text-xs font-semibold leading-none">
              {statusLabel(gps.status)}
              {gps.lastAccuracy != null ? ` · ${Math.round(gps.lastAccuracy)}m` : ''}
            </p>
            {gps.status === 'denied' && <p className="text-center text-red-600 text-xs">{tx.locOn}</p>}
            {gps.lastAccuracy != null && gps.lastAccuracy > GPS_WARN_ACCURACY_M && (
              <p className="text-center text-amber-700 text-xs">{tx.signal}</p>
            )}
            <div className="shrink-0 grid grid-cols-2 gap-1.5 pb-1">
              {gps.status === 'paused' ? (
                <button onClick={gps.resume} className={`bg-blue-600 text-white ${btn}`}>{tx.resume}</button>
              ) : (
                <button onClick={gps.pause} className={`bg-amber-500 text-white ${btn}`}>{tx.stop}</button>
              )}
              <button onClick={finishTrack} className={`bg-slate-900 text-white ${btn}`}>{tx.complete}</button>
            </div>
          </div>
        )}

        {tab === 'measure' && phase === 'review' && (
          <div className="h-full overflow-y-auto space-y-2 pb-2">
            <div className="text-center">
              <p className="text-xs text-gray-500">{tx.total}</p>
              <p className="text-2xl font-bold">{fmtAcre(gps.geometry.acres)} {tx.acre}</p>
              <p className="text-lg font-semibold text-amber-800">{fmtGuntha(gps.geometry.guntha)} {tx.guntha}</p>
            </div>
            <div className="h-40"><GpsMap points={gps.points} here={gps.here} satellite={satellite} /></div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" disabled={speaking} onClick={() => speakNow(gps.geometry.acres, gps.geometry.guntha)} className={`bg-blue-600 text-white ${btn} inline-flex items-center justify-center gap-1 disabled:opacity-70`}>
                <Volume2 size={16} /> {speaking ? tx.speaking : tx.speak}
              </button>
              <button type="button" onClick={() => setSatellite((s) => !s)} className={`border ${btn}`}>{satellite ? tx.map : tx.sat}</button>
            </div>
            {gps.points.length < GPS_MIN_POINTS_FOR_POLYGON && <p className="text-center text-red-600 text-xs">{tx.walk}</p>}
            <button disabled={gps.points.length < GPS_MIN_POINTS_FOR_POLYGON} onClick={saveMeasurement} className={`w-full bg-green-500 text-white ${btn} disabled:bg-gray-300`}>{tx.save}</button>
            <button type="button" disabled={sharing || gps.points.length < 1} onClick={() => shareNow(gps.points)} className={`w-full bg-green-700 text-white ${btn} inline-flex items-center justify-center gap-1 disabled:bg-gray-300`}>
              <Share2 size={16} /> {sharing ? tx.sending : tx.wa}
            </button>
            {shareError && <p className="text-red-600 text-center text-xs">{shareError}</p>}
            <button onClick={discardMeasurement} className={`w-full bg-gray-200 ${btn}`}>{tx.cancel}</button>
            <button type="button" onClick={() => setShowOptional((v) => !v)} className="w-full text-gray-500 text-xs py-1">
              {showOptional ? tx.hideFarmer : tx.showFarmer}
            </button>
            {showOptional && (
              <div className="space-y-2 p-2 rounded-xl border border-dashed">
                <p className="text-xs text-gray-500">{tx.skip}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'harvester', label: tx.harv },
                    { id: 'tractor', label: tx.trac },
                    { id: 'excavator', label: tx.excav },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setMachine(m.id)} className={`py-2 rounded-lg text-xs font-semibold ${machine === m.id ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {farmers.slice(0, 20).map((f) => (
                    <button key={f.id} onClick={() => setFarmerId(f.id)} className={`w-full text-left p-2 rounded-lg border text-sm ${farmerId === f.id ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && !detail && (
          <div className="h-full overflow-y-auto space-y-2 pb-2">
            <h2 className="text-lg font-bold">{tx.old}</h2>
            {completed.map((row) => (
              <button key={row.localUuid} onClick={() => setDetail(row)} className="w-full text-left p-3 rounded-xl border">
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-sm font-semibold">{row.customerName === PLACEHOLDER_MR || row.customerName === PLACEHOLDER_EN ? tx.item : row.customerName}</span>
                  <span className="text-right">
                    <span className="block text-base font-bold text-green-700">{fmtAcre(row.areaAcre)} {tx.acre}</span>
                    <span className="block text-xs">{fmtGuntha(row.areaGunta || toGuntha(row.areaAcre))} {tx.guntha}</span>
                  </span>
                </div>
              </button>
            ))}
            {completed.length === 0 && <p className="text-gray-500 text-sm">{tx.none}</p>}
            {pendingSync > 0 && (
              <button onClick={sync.syncPending} className={`w-full bg-slate-900 text-white ${btn} inline-flex items-center justify-center gap-1`}>
                <RefreshCw size={14} /> {sync.syncing ? tx.sending : tx.sync}
              </button>
            )}
          </div>
        )}

        {tab === 'history' && detail && (
          <div className="h-full overflow-y-auto space-y-2 pb-2">
            <button className="text-sm font-semibold" onClick={() => setDetail(null)}>← {tx.back}</button>
            <p className="text-2xl font-bold text-center">{fmtAcre(detail.areaAcre)} {tx.acre}</p>
            <p className="text-lg text-center">{fmtGuntha(detail.areaGunta || toGuntha(detail.areaAcre))} {tx.guntha}</p>
            <button type="button" disabled={speaking} onClick={() => speakNow(detail.areaAcre, detail.areaGunta || toGuntha(detail.areaAcre))} className={`w-full bg-blue-600 text-white ${btn} inline-flex items-center justify-center gap-1 disabled:opacity-70`}>
              <Volume2 size={16} /> {speaking ? tx.speaking : tx.speak}
            </button>
            <div className="h-40"><GpsMap points={detail.points} satellite={satellite} /></div>
            <button type="button" onClick={() => setSatellite((s) => !s)} className={`w-full border ${btn}`}>{satellite ? tx.map : tx.sat}</button>
            <button type="button" disabled={sharing} onClick={() => shareNow(detail.points, detail)} className={`w-full bg-green-700 text-white ${btn} inline-flex items-center justify-center gap-1`}>
              <Share2 size={16} /> {sharing ? tx.sending : tx.wa}
            </button>
            {shareError && <p className="text-red-600 text-center text-xs">{shareError}</p>}
          </div>
        )}
      </main>

      <nav className="shrink-0 px-2 pt-1 bg-white" style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto glass-panel rounded-xl grid grid-cols-3 p-0.5">
          <button onClick={() => { setTab('home'); setDetail(null) }} className={`flex flex-col items-center py-1.5 rounded-lg text-[11px] font-semibold ${tab === 'home' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>
            <MapPin size={16} /> {tx.navHome}
          </button>
          <button onClick={() => { setTab('measure'); setDetail(null) }} className={`flex flex-col items-center py-1.5 rounded-lg text-[11px] font-semibold ${tab === 'measure' ? 'bg-green-50 text-green-700' : 'text-gray-600'}`}>
            <Plus size={16} /> {tx.navStart}
          </button>
          <button onClick={() => { setTab('history') }} className={`flex flex-col items-center py-1.5 rounded-lg text-[11px] font-semibold ${tab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>
            <Search size={16} /> {tx.navOld}
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
