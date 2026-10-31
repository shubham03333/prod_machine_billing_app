import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor } from '@/lib/field-auth'

export const dynamic = 'force-dynamic'

function paymentStatusFor(paidAmount: number, totalAmount: number) {
  if (paidAmount >= totalAmount - 0.009) return 'PAID'
  if (paidAmount > 0.009) return 'PARTIALLY_PAID'
  return 'UNPAID'
}

async function syncBillPaidAmount(billId: number) {
  const billRentals = await prisma.rental.findMany({
    where: { billId },
  })
  const billPaidAmount = billRentals.reduce((sum, r) => sum + (r.paidAmount || 0), 0)
  const billTotalAmount = billRentals.reduce((sum, r) => sum + r.totalAmount, 0)
  let billStatus = 'UNPAID'
  if (billPaidAmount >= billTotalAmount) {
    billStatus = 'PAID'
  } else if (billPaidAmount > 0) {
    billStatus = 'PARTIALLY_PAID'
  }
  await prisma.bill.update({
    where: { id: billId },
    data: {
      paidAmount: billPaidAmount,
      status: billStatus,
    },
  })
}

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
    const paymentId = parseInt(id, 10)
    if (!Number.isFinite(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        rental: {
          select: { id: true, paidAmount: true, totalAmount: true, billId: true },
        },
      },
    })
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const newPaidAmount = Math.max(0, (payment.rental.paidAmount || 0) - payment.amount)

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } })
      await tx.rental.update({
        where: { id: payment.rental.id },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: paymentStatusFor(newPaidAmount, payment.rental.totalAmount),
        },
      })
    })

    if (payment.rental.billId) {
      await syncBillPaidAmount(payment.rental.billId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
