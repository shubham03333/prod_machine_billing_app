import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor } from '@/lib/field-auth'
import { hashPin, isValidOperatorPin, verifyPin } from '@/lib/gps/crypto'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkReadOnlyGuard(request)
  if (denied) return denied
  const auth = await requireAdminEditor(request)
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    const operatorDbId = parseInt(id, 10)
    const body = await request.json()

    const data: {
      name?: string
      phone?: string
      machine?: string
      status?: string
      pinSalt?: string
      pinHash?: string
    } = {}

    if (body.name) data.name = String(body.name).trim()
    if (body.phone) data.phone = String(body.phone).trim()
    if (body.machine) data.machine = String(body.machine).trim()
    if (body.status) data.status = String(body.status).trim()
    if (body.pin) {
      const pin = String(body.pin).trim()
      if (!isValidOperatorPin(pin)) {
        return NextResponse.json({ error: 'PIN must be 4 or 6 digits' }, { status: 400 })
      }
      const others = await prisma.fieldOperator.findMany({ where: { id: { not: operatorDbId } } })
      if (others.some((op) => verifyPin(pin, op.pinSalt, op.pinHash))) {
        return NextResponse.json({ error: 'This PIN is already used by another field operator' }, { status: 409 })
      }
      const hashed = hashPin(pin)
      data.pinSalt = hashed.pinSalt
      data.pinHash = hashed.pinHash
    }

    const updated = await prisma.fieldOperator.update({
      where: { id: operatorDbId },
      data,
    })

    if (data.name) {
      await prisma.user.update({
        where: { id: updated.linkedUserId },
        data: { name: data.name },
      })
    }

    return NextResponse.json({
      id: updated.id,
      operatorId: updated.operatorId,
      name: updated.name,
      phone: updated.phone,
      status: updated.status,
      machine: updated.machine,
    })
  } catch (error) {
    console.error('Update field operator error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
