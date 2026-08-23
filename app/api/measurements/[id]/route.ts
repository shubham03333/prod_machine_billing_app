import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminEditor, requireAdminViewer, requireFieldOperator } from '@/lib/field-auth'
import { approveMeasurement } from '@/lib/gps/billing'
import {
  APPROVAL_PENDING,
  APPROVAL_REJECTED,
  SQM_PER_ACRE,
  SQM_PER_HECTARE,
} from '@/lib/gps/constants'

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminEditor(request)
  if ('error' in admin) return admin.error

  try {
    const { id } = await params
    const measurementId = parseInt(id, 10)
    const row = await prisma.gpsMeasurement.findUnique({
      where: { id: measurementId },
      include: { customer: true, rental: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (row.approvalStatus === 'APPROVED' || row.rental) {
      return NextResponse.json({ error: 'Approved records can be edited from Overview rentals' }, { status: 400 })
    }
    if (row.approvalStatus === 'REJECTED') {
      return NextResponse.json({ error: 'Rejected measurement cannot be edited' }, { status: 400 })
    }

    const body = await request.json()
    const acres = Number(body.areaAcre)
    const guntha = Number(body.areaGunta)
    const ratePerAcre = Number(body.ratePerAcre)
    if (!Number.isFinite(acres) || acres < 0) {
      return NextResponse.json({ error: 'Invalid acres' }, { status: 400 })
    }
    if (!Number.isFinite(guntha) || guntha < 0) {
      return NextResponse.json({ error: 'Invalid guntha' }, { status: 400 })
    }
    if (!Number.isFinite(ratePerAcre) || ratePerAcre < 0) {
      return NextResponse.json({ error: 'Invalid rate per acre' }, { status: 400 })
    }

    const amountInput = Number(body.amount)
    const amount = Number.isFinite(amountInput) && amountInput >= 0 ? amountInput : acres * ratePerAcre
    const customerName = String(body.customerName || row.customer.name).trim()
    const village = String(body.village ?? row.village ?? '').trim()

    await prisma.customer.update({
      where: { id: row.customerId },
      data: {
        name: customerName || row.customer.name,
        address: village || row.customer.address,
      },
    })

    const updated = await prisma.gpsMeasurement.update({
      where: { id: measurementId },
      data: {
        village: village || null,
        areaAcre: acres,
        areaGunta: guntha,
        areaSqm: acres * SQM_PER_ACRE,
        areaHectare: (acres * SQM_PER_ACRE) / SQM_PER_HECTARE,
        ratePerAcre,
        amount,
        approvalStatus: APPROVAL_PENDING,
      },
      include: {
        customer: { select: { id: true, name: true, address: true, contactNumber: true } },
        fieldOperator: { select: { name: true, operatorId: true, machine: true } },
        rental: { select: { id: true, billId: true, totalAmount: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update measurement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminEditor(request)
  if ('error' in admin) return admin.error

  try {
    const { id } = await params
    const measurementId = parseInt(id, 10)
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'approve').toLowerCase()

    const row = await prisma.gpsMeasurement.findUnique({
      where: { id: measurementId },
      include: { rental: true },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'reject') {
      if (row.rental) {
        return NextResponse.json({ error: 'Already promoted to a rental' }, { status: 400 })
      }
      const rejected = await prisma.gpsMeasurement.update({
        where: { id: measurementId },
        data: { approvalStatus: APPROVAL_REJECTED },
      })
      return NextResponse.json(rejected)
    }

    if (row.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Measurement is not completed' }, { status: 400 })
    }

    const rental = await approveMeasurement(measurementId)
    const updated = await prisma.gpsMeasurement.findUnique({
      where: { id: measurementId },
      include: {
        customer: { select: { id: true, name: true, address: true, contactNumber: true } },
        fieldOperator: { select: { name: true, operatorId: true, machine: true } },
        rental: { select: { id: true, billId: true, totalAmount: true } },
      },
    })
    return NextResponse.json({ ...updated, rentalId: rental?.id ?? updated?.rental?.id ?? null })
  } catch (error) {
    console.error('Approve measurement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
