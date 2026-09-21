import { prisma } from '@/lib/prisma'
import { cashTransferDb } from '@/lib/payments/transfer-db'

export type OperatorHolding = {
  operatorId: number
  operatorName: string
  collected: number
  paymentCount: number
  handedOver: number
  received: number
  holding: number
}

export type CollectionPaymentRow = {
  id: number
  amount: number
  mode: string
  date: Date
  operatorId: number | null
  operatorName: string
  customerName: string
  rentalId: number
  machineType: string
}

export type CashTransferRow = {
  id: number
  amount: number
  note: string | null
  date: Date
  fromUserId: number
  fromName: string
  toUserId: number
  toName: string
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export async function loadOperatorHoldings(): Promise<{
  operators: OperatorHolding[]
  payments: CollectionPaymentRow[]
  transfers: CashTransferRow[]
}> {
  const [payments, transfers, staff] = await Promise.all([
    prisma.payment.findMany({
      where: { collectedByUserId: { not: null } },
      include: {
        collectedBy: { select: { id: true, name: true } },
        rental: {
          select: {
            id: true,
            machineType: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    cashTransferDb().findMany({
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'operator' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const map = new Map<number, OperatorHolding>()

  function ensure(id: number, name: string): OperatorHolding {
    const existing = map.get(id)
    if (existing) return existing
    const created: OperatorHolding = {
      operatorId: id,
      operatorName: name,
      collected: 0,
      paymentCount: 0,
      handedOver: 0,
      received: 0,
      holding: 0,
    }
    map.set(id, created)
    return created
  }

  for (const user of staff) {
    ensure(user.id, user.name)
  }

  for (const payment of payments) {
    if (!payment.collectedByUserId || !payment.collectedBy) continue
    const row = ensure(payment.collectedByUserId, payment.collectedBy.name)
    row.collected = roundMoney(row.collected + payment.amount)
    row.paymentCount += 1
  }

  for (const transfer of transfers) {
    const from = ensure(transfer.fromUserId, transfer.fromUser.name)
    const to = ensure(transfer.toUserId, transfer.toUser.name)
    from.handedOver = roundMoney(from.handedOver + transfer.amount)
    to.received = roundMoney(to.received + transfer.amount)
  }

  const holdingRows = Array.from(map.values())
  for (const row of holdingRows) {
    row.holding = roundMoney(row.collected - row.handedOver + row.received)
  }

  const operators = holdingRows.sort((a, b) => b.holding - a.holding || b.collected - a.collected)

  return {
    operators,
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      mode: payment.mode,
      date: payment.date,
      operatorId: payment.collectedByUserId,
      operatorName: payment.collectedBy?.name || '',
      customerName: payment.rental.customer.name,
      rentalId: payment.rental.id,
      machineType: payment.rental.machineType,
    })),
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      amount: transfer.amount,
      note: transfer.note,
      date: transfer.date,
      fromUserId: transfer.fromUserId,
      fromName: transfer.fromUser.name,
      toUserId: transfer.toUserId,
      toName: transfer.toUser.name,
    })),
  }
}
