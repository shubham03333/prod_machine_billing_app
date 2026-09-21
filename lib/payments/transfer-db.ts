import { prisma } from '@/lib/prisma'

type CashTransferRecord = {
  id: number
  amount: number
  note: string | null
  date: Date
  fromUserId: number
  toUserId: number
  fromUser: { id: number; name: string }
  toUser: { id: number; name: string }
}

type CashTransferDb = {
  findMany: (args: {
    include: {
      fromUser: { select: { id: true; name: true } }
      toUser: { select: { id: true; name: true } }
    }
    orderBy: { createdAt: 'desc' }
  }) => Promise<CashTransferRecord[]>
  create: (args: {
    data: {
      fromUserId: number
      toUserId: number
      amount: number
      note: string | null
      createdByUserId: number | null
    }
  }) => Promise<{ id: number }>
  count: (args: { where: Record<string, unknown> }) => Promise<number>
  updateMany: (args: {
    where: Record<string, unknown>
    data: Record<string, unknown>
  }) => Promise<{ count: number }>
}

export function cashTransferDb(): CashTransferDb {
  return (prisma as unknown as { operatorCashTransfer: CashTransferDb }).operatorCashTransfer
}
