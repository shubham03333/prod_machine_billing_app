import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor } from '@/lib/field-auth'
import { isValidOperatorPin, verifyPin } from '@/lib/gps/crypto'
import { ROLE_OPERATOR } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const operators = await prisma.user.findMany({
      where: { role: ROLE_OPERATOR },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(operators)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkReadOnlyGuard(request)
  if (denied) return denied
  const auth = await requireAdminEditor(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const pin = String(body?.pin ?? '').trim()

    if (!name || !pin) {
      return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 })
    }
    if (!isValidOperatorPin(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 or 6 digits' }, { status: 400 })
    }

    const pinTaken = await prisma.user.findUnique({
      where: { pin },
      select: { id: true },
    })
    if (pinTaken) {
      return NextResponse.json({ error: 'This PIN is already in use' }, { status: 409 })
    }

    const fieldOps = await prisma.fieldOperator.findMany({
      select: { pinSalt: true, pinHash: true },
    })
    if (fieldOps.some((op) => verifyPin(pin, op.pinSalt, op.pinHash))) {
      return NextResponse.json({ error: 'This PIN is already used by a field operator' }, { status: 409 })
    }

    const created = await prisma.user.create({
      data: {
        name,
        role: ROLE_OPERATOR,
        pin,
      },
      select: { id: true, name: true, role: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Create operator error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
