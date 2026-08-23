import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEYLEN = 32

export function hashPin(pin: string): { pinSalt: string; pinHash: string } {
  const pinSalt = randomBytes(16).toString('hex')
  const pinHash = scryptSync(pin, pinSalt, KEYLEN).toString('hex')
  return { pinSalt, pinHash }
}

export function verifyPin(pin: string, pinSalt: string, pinHash: string): boolean {
  try {
    const computed = scryptSync(pin, pinSalt, KEYLEN)
    const stored = Buffer.from(pinHash, 'hex')
    if (computed.length !== stored.length) return false
    return timingSafeEqual(computed, stored)
  } catch {
    return false
  }
}

export function isValidOperatorPin(pin: string): boolean {
  return /^\d{4}$|^\d{6}$/.test(pin)
}

function sessionSecret(): string {
  return process.env.GPS_SESSION_SECRET || process.env.DATABASE_URL || 'rentra-gps-dev-secret'
}

export type FieldTokenPayload = {
  sub: number
  oid: string
  exp: number
}

export function signFieldToken(operatorDbId: number, operatorId: string, ttlMs = 1000 * 60 * 60 * 12): string {
  const payload: FieldTokenPayload = {
    sub: operatorDbId,
    oid: operatorId,
    exp: Date.now() + ttlMs,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyFieldToken(token: string): FieldTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FieldTokenPayload
    if (!payload.sub || !payload.oid || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
