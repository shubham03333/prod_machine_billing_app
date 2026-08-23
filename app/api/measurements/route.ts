import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminViewer, requireFieldOperator } from '@/lib/field-auth'

export const dynamic = 'force-dynamic'

async function listForOperator(fieldOperatorId: number) {
  return prisma.gpsMeasurement.findMany({
    where: { fieldOperatorId },
    include: {
      customer: { select: { id: true, name: true, address: true, contactNumber: true } },
      fieldOperator: { select: { name: true, operatorId: true, machine: true } },
      rental: { select: { id: true, billId: true, totalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function GET(request: NextRequest) {
  try {
    const fieldAuth = await requireFieldOperator(request)
    if (!('error' in fieldAuth)) {
      const rows = await listForOperator(fieldAuth.operator.id)
      return NextResponse.json(rows)
    }

    const admin = await requireAdminViewer(request)
    if ('error' in admin) return admin.error

    const rows = await prisma.gpsMeasurement.findMany({
      include: {
        customer: { select: { id: true, name: true, address: true, contactNumber: true } },
        fieldOperator: { select: { name: true, operatorId: true, machine: true } },
        rental: { select: { id: true, billId: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('List measurements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
