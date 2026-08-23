import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, isValidOperatorPin, signFieldToken, verifyPin } from '@/lib/gps/crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pin = String(body?.pin ?? '').trim()

    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
    }
    if (!isValidOperatorPin(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 or 6 digits' }, { status: 400 })
    }

    const operators = await prisma.fieldOperator.findMany()
    const matches = operators.filter((op) => verifyPin(pin, op.pinSalt, op.pinHash))
    if (matches.length === 0) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }
    if (matches.length > 1) {
      return NextResponse.json({ error: 'This PIN is used by more than one operator. Ask admin to set a unique PIN.' }, { status: 409 })
    }

    const operator = matches[0]
    if (operator.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Operator is inactive' }, { status: 403 })
    }

    const token = signFieldToken(operator.id, operator.operatorId)
    return NextResponse.json({
      type: 'field_operator',
      id: operator.id,
      operatorId: operator.operatorId,
      name: operator.name,
      phone: operator.phone,
      machine: operator.machine,
      token,
    })
  } catch (error) {
    console.error('Field login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
