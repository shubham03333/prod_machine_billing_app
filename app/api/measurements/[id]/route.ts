import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminViewer, requireFieldOperator } from '@/lib/field-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const measurementId = parseInt(id, 10)
    const row = await prisma.gpsMeasurement.findUnique({
      where: { id: measurementId },
      include: {
        customer: true,
        fieldOperator: { select: { name: true, operatorId: true, machine: true, phone: true } },
        points: { orderBy: { sequenceNumber: 'asc' } },
        rental: true,
      },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fieldAuth = await requireFieldOperator(request)
    if (!('error' in fieldAuth)) {
      if (row.fieldOperatorId !== fieldAuth.operator.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json(row)
    }

    const admin = await requireAdminViewer(request)
    if ('error' in admin) return admin.error
    return NextResponse.json(row)
  } catch (error) {
    console.error('Get measurement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
