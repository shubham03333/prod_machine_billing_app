import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor } from '@/lib/field-auth'
import { ROLE_OPERATOR } from '@/lib/roles'
import { cashTransferDb } from '@/lib/payments/transfer-db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkReadOnlyGuard(request)
  if (denied) return denied
  const auth = await requireAdminEditor(request)
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    const operatorId = parseInt(id, 10)
    if (!Number.isFinite(operatorId)) {
      return NextResponse.json({ error: 'Invalid operator' }, { status: 400 })
    }

    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      select: { id: true, name: true, role: true },
    })
    if (!operator || operator.role !== ROLE_OPERATOR) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    const cash = cashTransferDb()
    const [rentalCount, expenseCount, transferFrom, transferTo] = await Promise.all([
      prisma.rental.count({ where: { operatorId } }),
      prisma.expense.count({ where: { operatorId } }),
      cash.count({ where: { fromUserId: operatorId } }),
      cash.count({ where: { toUserId: operatorId } }),
    ])

    if (rentalCount || expenseCount || transferFrom || transferTo) {
      return NextResponse.json(
        {
          error: `Cannot delete ${operator.name}. They still have ${rentalCount} rental(s), ${expenseCount} expense(s), and ${transferFrom + transferTo} cash transfer(s).`,
        },
        { status: 409 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { collectedByUserId: operatorId },
        data: { collectedByUserId: null },
      })
      await cashTransferDb().updateMany({
        where: { createdByUserId: operatorId },
        data: { createdByUserId: null },
      })
      await tx.user.delete({ where: { id: operatorId } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete operator error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
