import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, isValidOperatorPin, signFieldToken, verifyPin } from '@/lib/gps/crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const operatorId = String(body?.operatorId ?? '').trim()
    const pin = String(body?.pin ?? '').trim()

    if (!operatorId || !pin) {
      return NextResponse.json({ error: 'Operator ID and PIN are required' }, { status: 400 })
    }
    if (!isValidOperatorPin(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 or 6 digits' }, { status: 400 })
    }

    const operator = await prisma.fieldOperator.findUnique({
      where: { operatorId },
    })
    if (!operator || !verifyPin(pin, operator.pinSalt, operator.pinHash)) {
      return NextResponse.json({ error: 'Invalid Operator ID or PIN' }, { status: 401 })
    }
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
