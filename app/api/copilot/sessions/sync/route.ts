import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { copilotDb } from '@/lib/copilot/db'
import { requireFieldOperator } from '@/lib/field-auth'
import { SQM_PER_ACRE, GUNTHA_PER_ACRE } from '@/lib/gps/constants'
import type { FilteredSample, GeoJsonPolygon } from '@/lib/copilot/types'

export const dynamic = 'force-dynamic'

type SyncBody = {
  localUuid?: string
  village?: string
  machine?: string
  copilotState?: string
  areaSqm?: number
  coverageGeoJson?: GeoJsonPolygon | null
  harvestPoints?: FilteredSample[]
  gpsPoints?: FilteredSample[]
  startedAt?: string | null
  stoppedAt?: string | null
  customerId?: number | null
}

export async function POST(request: NextRequest) {
  const auth = await requireFieldOperator(request)
  if ('error' in auth) return auth.error
  const operator = auth.operator

  try {
    const body = (await request.json()) as SyncBody
    const localUuid = String(body.localUuid || '').trim()
    if (!localUuid) return NextResponse.json({ error: 'localUuid is required' }, { status: 400 })

    const areaSqm = Number(body.areaSqm || 0)
    const acres = areaSqm / SQM_PER_ACRE
    const harvestPoints = Array.isArray(body.harvestPoints) ? body.harvestPoints : []
    const trail = Array.isArray(body.gpsPoints) ? body.gpsPoints : []
    const points = trail.length > 0 ? trail : harvestPoints

    const payload = {
      fieldOperatorId: operator.id,
      customerId: body.customerId && body.customerId > 0 ? body.customerId : null,
      machine: String(body.machine || operator.machine),
      village: body.village ? String(body.village) : null,
      copilotState: String(body.copilotState || 'IDLE'),
      areaSqm,
      areaAcre: acres,
      areaGunta: acres * GUNTHA_PER_ACRE,
      distanceMeters: 0,
      coverageGeoJson: body.coverageGeoJson ? JSON.stringify(body.coverageGeoJson) : null,
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      stoppedAt: body.stoppedAt ? new Date(body.stoppedAt) : null,
      syncStatus: 'SYNCED',
    }

    const saved = await prisma.$transaction(async (tx) => {
      const db = tx as unknown as ReturnType<typeof copilotDb>
      const session = await db.copilotHarvestSession.upsert({
        where: { localUuid },
        create: { localUuid, ...payload },
        update: payload,
      })
      await db.copilotGpsPoint.deleteMany({ where: { sessionId: session.id } })
      if (points.length > 0) {
        await db.copilotGpsPoint.createMany({
          data: points.map((p, index) => ({
            sessionId: session.id,
            sequenceNumber: index + 1,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy,
            speedKmh: p.speedKmh,
            headingDeg: p.headingDeg,
            timestamp: new Date(p.timestamp),
          })),
        })
      }
      return session
    })

    return NextResponse.json({ cloudId: saved.id, localUuid: saved.localUuid, syncStatus: 'SYNCED' })
  } catch (error) {
    console.error('Copilot sync', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
