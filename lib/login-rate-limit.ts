import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_ATTEMPTS_PER_IP = 10
const MAX_FAILURES_PER_IP = 5
const MAX_FAILURES_PER_PIN = 12
const CLEAN_EVERY = 50

type Bucket = {
  windowStart: number
  attempts: number
  failures: number
  lockedUntil: number
}

type Store = {
  ip: Map<string, Bucket>
  pin: Map<string, Bucket>
  hits: number
}

const globalStore = globalThis as unknown as { __rentraLoginRateLimit?: Store }

function store(): Store {
  if (!globalStore.__rentraLoginRateLimit) {
    globalStore.__rentraLoginRateLimit = {
      ip: new Map(),
      pin: new Map(),
      hits: 0,
    }
  }
  return globalStore.__rentraLoginRateLimit
}

function now() {
  return Date.now()
}

function pruneMap(map: Map<string, Bucket>, t: number) {
  Array.from(map.entries()).forEach(([key, item]) => {
    const windowExpired = t - item.windowStart > WINDOW_MS
    const unlocked = item.lockedUntil <= t
    if (windowExpired && unlocked && item.failures === 0) {
      map.delete(key)
    }
  })
}

function bucket(map: Map<string, Bucket>, key: string, t: number): Bucket {
  let current = map.get(key)
  if (!current) {
    current = { windowStart: t, attempts: 0, failures: 0, lockedUntil: 0 }
    map.set(key, current)
    return current
  }
  if (t - current.windowStart > WINDOW_MS) {
    current.windowStart = t
    current.attempts = 0
    if (current.lockedUntil <= t) current.failures = 0
  }
  return current
}

function retryAfterSec(bucket: Bucket, t: number) {
  const lockLeft = Math.ceil((bucket.lockedUntil - t) / 1000)
  const windowLeft = Math.ceil((bucket.windowStart + WINDOW_MS - t) / 1000)
  return Math.max(1, lockLeft > 0 ? lockLeft : windowLeft)
}

function blockedResponse(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return NextResponse.json(
    {
      error: `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      retryAfterSec: seconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(seconds),
        'Cache-Control': 'no-store',
      },
    },
  )
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean)
    const ip = parts[parts.length - 1]
    if (ip) return ip.slice(0, 64)
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)
  return 'unknown'
}

export function pinFingerprint(pin: string): string {
  return createHash('sha256').update(`rentra-login:${pin}`).digest('hex').slice(0, 24)
}

export function checkIpLoginRateLimit(request: NextRequest): NextResponse | null {
  const s = store()
  const t = now()
  s.hits += 1
  if (s.hits % CLEAN_EVERY === 0) {
    pruneMap(s.ip, t)
    pruneMap(s.pin, t)
  }

  const ip = bucket(s.ip, clientIp(request), t)
  if (ip.lockedUntil > t) return blockedResponse(retryAfterSec(ip, t))
  if (ip.attempts >= MAX_ATTEMPTS_PER_IP) {
    ip.lockedUntil = Math.max(ip.lockedUntil, ip.windowStart + WINDOW_MS)
    return blockedResponse(retryAfterSec(ip, t))
  }
  ip.attempts += 1
  return null
}

export function checkPinLoginRateLimit(pin: string): NextResponse | null {
  if (!pin) return null
  const s = store()
  const t = now()
  const pinB = bucket(s.pin, pinFingerprint(pin), t)
  if (pinB.lockedUntil > t) return blockedResponse(retryAfterSec(pinB, t))
  if (pinB.failures >= MAX_FAILURES_PER_PIN) {
    pinB.lockedUntil = Math.max(pinB.lockedUntil, t + LOCK_MS)
    return blockedResponse(retryAfterSec(pinB, t))
  }
  return null
}

export function checkLoginRateLimit(request: NextRequest, pin: string): NextResponse | null {
  return checkIpLoginRateLimit(request) || checkPinLoginRateLimit(pin)
}

export function recordLoginFailure(request: NextRequest, pin: string) {
  const s = store()
  const t = now()
  const ip = bucket(s.ip, clientIp(request), t)
  ip.failures += 1
  if (ip.failures >= MAX_FAILURES_PER_IP) {
    ip.lockedUntil = t + LOCK_MS
  }
  if (!pin) return
  const pinB = bucket(s.pin, pinFingerprint(pin), t)
  pinB.failures += 1
  if (pinB.failures >= MAX_FAILURES_PER_PIN) {
    pinB.lockedUntil = t + LOCK_MS
  }
}

export function recordLoginSuccess(request: NextRequest, pin: string) {
  const s = store()
  const t = now()
  const ip = bucket(s.ip, clientIp(request), t)
  ip.failures = 0
  ip.lockedUntil = 0
  if (!pin) return
  const pinB = bucket(s.pin, pinFingerprint(pin), t)
  pinB.failures = 0
  pinB.lockedUntil = 0
}
