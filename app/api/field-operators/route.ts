import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor, requireAdminViewer } from '@/lib/field-auth'
import { hashPin, isValidOperatorPin, verifyPin } from '@/lib/gps/crypto'
import { ROLE_FIELD_OPERATOR } from '@/lib/roles'

export const dynamic = 'force-dynamic'

function publicOperator(row: {
  id: number
  operatorId: string
  name: string
  phone: string
  status: string
  machine: string
  createdAt: Date
}) {
  return {
    id: row.id,
    operatorId: row.operatorId,
    name: row.name,
    phone: row.phone,
    status: row.status,
    machine: row.machine,
    createdAt: row.createdAt,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminViewer(request)
  if ('error' in auth) return auth.error

  const rows = await prisma.fieldOperator.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      operatorId: true,
      name: true,
      phone: true,
      status: true,
      machine: true,
      createdAt: true,
    },
  })
  return NextResponse.json(rows.map(publicOperator))
}

export async function POST(request: NextRequest) {
  const denied = await checkReadOnlyGuard(request)
  if (denied) return denied
  const auth = await requireAdminEditor(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const operatorId = String(body?.operatorId ?? '').trim()
    const name = String(body?.name ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const pin = String(body?.pin ?? '').trim()
    const machine = String(body?.machine ?? 'harvester').trim()
    const status = String(body?.status ?? 'ACTIVE').trim() || 'ACTIVE'

    if (!operatorId || !name || !phone || !pin) {
      return NextResponse.json({ error: 'Operator ID, name, phone and PIN are required' }, { status: 400 })
    }
    if (!isValidOperatorPin(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 or 6 digits' }, { status: 400 })
    }

    const others = await prisma.fieldOperator.findMany()
    if (others.some((op) => verifyPin(pin, op.pinSalt, op.pinHash))) {
      return NextResponse.json({ error: 'This PIN is already used by another field operator' }, { status: 409 })
    }

    const exists = await prisma.fieldOperator.findUnique({ where: { operatorId } })
    if (exists) {
      return NextResponse.json({ error: 'Operator ID already exists' }, { status: 409 })
    }

    const { pinSalt, pinHash } = hashPin(pin)
    const linkedPin = `xfo_${operatorId}`

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          role: ROLE_FIELD_OPERATOR,
          pin: linkedPin,
        },
      })
      return tx.fieldOperator.create({
        data: {
          operatorId,
          name,
          phone,
          pinSalt,
          pinHash,
          machine,
          status,
          linkedUserId: user.id,
        },
      })
    })

    return NextResponse.json(publicOperator(created), { status: 201 })
  } catch (error) {
    console.error('Create field operator error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
