import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyFieldToken } from '@/lib/gps/crypto'
import { canEditAdminData } from '@/lib/roles'

export function readBearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return request.headers.get('x-field-token')?.trim() || null
}

export async function requireFieldOperator(request: NextRequest) {
  const token = readBearer(request)
  if (!token) {
    return { error: NextResponse.json({ error: 'Field operator login required' }, { status: 401 }) }
  }
  const payload = verifyFieldToken(token)
  if (!payload) {
    return { error: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }) }
  }
  const operator = await prisma.fieldOperator.findUnique({
    where: { id: payload.sub },
  })
  if (!operator || operator.status !== 'ACTIVE') {
    return { error: NextResponse.json({ error: 'Operator inactive or not found' }, { status: 403 }) }
  }
  return { operator }
}

export async function requireAdminEditor(request: NextRequest) {
  const pin = request.headers.get('x-user-pin')?.trim()
  if (!pin) {
    return { error: NextResponse.json({ error: 'Admin authentication required' }, { status: 401 }) }
  }
  const user = await prisma.user.findUnique({
    where: { pin },
    select: { id: true, name: true, role: true, pin: true },
  })
  if (!canEditAdminData(user)) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { user }
}

export async function requireAdminViewer(request: NextRequest) {
  const pin = request.headers.get('x-user-pin')?.trim()
  if (!pin) {
    return { error: NextResponse.json({ error: 'Admin authentication required' }, { status: 401 }) }
  }
  const user = await prisma.user.findUnique({
    where: { pin },
    select: { id: true, name: true, role: true, pin: true },
  })
  if (!user) {
    return { error: NextResponse.json({ error: 'Invalid PIN' }, { status: 401 }) }
  }
  const role = (user.role || '').trim().toLowerCase()
  if (role === 'operator' || role === 'field_operator') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { user }
}
