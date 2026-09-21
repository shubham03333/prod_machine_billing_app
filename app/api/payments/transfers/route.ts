import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminEditor } from '@/lib/field-auth'
import { loadOperatorHoldings } from '@/lib/payments/holdings'
import { cashTransferDb } from '@/lib/payments/transfer-db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await requireAdminEditor(request)
  if ('error' in admin) return admin.error

  try {
    const body = (await request.json()) as {
      fromUserId?: number | string
      toUserId?: number | string
      amount?: number | string
      note?: string
    }
    const fromUserId = parseInt(String(body.fromUserId ?? ''), 10)
    const toUserId = parseInt(String(body.toUserId ?? ''), 10)
    const amount = Math.round(parseFloat(String(body.amount ?? '')) * 100) / 100
    const note = body.note ? String(body.note).trim() : null

    if (!Number.isFinite(fromUserId) || !Number.isFinite(toUserId) || fromUserId <= 0 || toUserId <= 0) {
      return NextResponse.json({ error: 'Select from and to operators' }, { status: 400 })
    }
    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'From and to operators must be different' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
    }

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true } }),
    ])
    if (!fromUser || !toUser) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 400 })
    }

    const holdings = await loadOperatorHoldings()
    const fromHolding = holdings.operators.find((row) => row.operatorId === fromUserId)
    const available = fromHolding?.holding ?? 0
    if (amount - available > 0.009) {
      return NextResponse.json(
        { error: `Only ${available.toFixed(2)} is currently with ${fromUser.name}` },
        { status: 400 },
      )
    }

    const transfer = await cashTransferDb().create({
      data: {
        fromUserId,
        toUserId,
        amount,
        note,
        createdByUserId: admin.user?.id ?? null,
      },
    })

    return NextResponse.json({ transferId: transfer.id }, { status: 201 })
  } catch (error) {
    console.error('Operator cash transfer POST', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
