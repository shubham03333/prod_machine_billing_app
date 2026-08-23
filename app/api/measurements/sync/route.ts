import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFieldOperator } from '@/lib/field-auth'
import { ensureRentalForMeasurement } from '@/lib/gps/billing'
import { GPS_MIN_POINTS_FOR_POLYGON } from '@/lib/gps/constants'

export const dynamic = 'force-dynamic'

type SyncPoint = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number | string
}

export async function POST(request: NextRequest) {
  const auth = await requireFieldOperator(request)
  if ('error' in auth) return auth.error
  const operator = auth.operator

  try {
    const body = await request.json()
    const localUuid = String(body?.localUuid ?? '').trim()
    if (!localUuid) {
      return NextResponse.json({ error: 'localUuid is required' }, { status: 400 })
    }

    const customerId = parseInt(String(body.customerId), 10)
    const points = Array.isArray(body.points) ? (body.points as SyncPoint[]) : []
    const status = String(body.status || 'COMPLETED')
    if (status === 'COMPLETED' && points.length < GPS_MIN_POINTS_FOR_POLYGON) {
      return NextResponse.json({ error: 'Need at least 3 GPS points' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json({ error: 'Farmer not found' }, { status: 400 })
    }

    const pointData = points.map((p, index) => ({
      sequenceNumber: index + 1,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      accuracy: Number(p.accuracy),
      timestamp: new Date(p.timestamp),
    }))

    const payload = {
      fieldOperatorId: operator.id,
      customerId,
      machine: String(body.machine || operator.machine),
      village: body.village ? String(body.village) : customer.address,
      status,
      syncStatus: 'SYNCED',
      areaSqm: Number(body.areaSqm || 0),
      areaAcre: Number(body.areaAcre || 0),
      areaGunta: Number(body.areaGunta || 0),
      areaHectare: Number(body.areaHectare || 0),
      distanceMeters: Number(body.distanceMeters || 0),
      ratePerAcre: Number(body.ratePerAcre || 0),
      amount: Number(body.amount || 0),
      gpsQuality: body.gpsQuality ? String(body.gpsQuality) : null,
      startedAt: new Date(body.startedAt || Date.now()),
      stoppedAt: new Date(body.stoppedAt || Date.now()),
    }

    const existing = await prisma.gpsMeasurement.findUnique({
      where: { localUuid },
      select: { id: true, fieldOperatorId: true },
    })

    if (existing && existing.fieldOperatorId !== operator.id) {
      return NextResponse.json({ error: 'Measurement belongs to another operator' }, { status: 403 })
    }

    const saved = await prisma.$transaction(async (tx) => {
      const measurement = existing
        ? await tx.gpsMeasurement.update({
            where: { localUuid },
            data: payload,
          })
        : await tx.gpsMeasurement.create({
            data: { localUuid, ...payload },
          })

      await tx.gpsMeasurementPoint.deleteMany({ where: { measurementId: measurement.id } })
      if (pointData.length > 0) {
        await tx.gpsMeasurementPoint.createMany({
          data: pointData.map((p) => ({ ...p, measurementId: measurement.id })),
        })
      }

      await tx.gpsSyncLog.create({
        data: {
          measurementId: measurement.id,
          localUuid,
          action: existing ? 'UPDATE' : 'INSERT',
          status: 'SYNCED',
          message: 'Idempotent upsert',
        },
      })

      return measurement
    })

    if (saved.status === 'COMPLETED') {
      await ensureRentalForMeasurement(saved.id)
    }

    const full = await prisma.gpsMeasurement.findUnique({
      where: { id: saved.id },
      include: { rental: { select: { id: true, billId: true } } },
    })

    return NextResponse.json({
      cloudId: saved.id,
      localUuid: saved.localUuid,
      syncStatus: 'SYNCED',
      rentalId: full?.rental?.id ?? null,
    })
  } catch (error) {
    console.error('Measurement sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
