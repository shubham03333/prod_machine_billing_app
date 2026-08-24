import { NextRequest, NextResponse } from 'next/server'
import { copilotDb } from '@/lib/copilot/db'
import { requireAdminEditor, requireAdminViewer, requireFieldOperator } from '@/lib/field-auth'
import { DEFAULT_COPILOT_SETTINGS, type CopilotSettings } from '@/lib/copilot/types'

export const dynamic = 'force-dynamic'

function toSettings(row: {
  machineName: string
  cutterWidthM: number
  effectiveWidthM: number
  minHarvestKmh: number
  maxHarvestKmh: number
  travelSpeedKmh: number
  minGpsAccuracyM: number
  minMoveM: number
  maxJumpM: number
  maxSpeedMps: number
  parallelPassToleranceM: number
  headingTurnMinDeg: number
  headingTurnMaxDeg: number
  autoStopDelayMs: number
  travelConfidenceThreshold: number
  harvestConfidenceThreshold: number
  possibleFieldHoldMs: number
}): CopilotSettings {
  return {
    machineName: row.machineName,
    cutterWidthM: row.cutterWidthM,
    effectiveWidthM: row.effectiveWidthM,
    minHarvestKmh: row.minHarvestKmh,
    maxHarvestKmh: row.maxHarvestKmh,
    travelSpeedKmh: row.travelSpeedKmh,
    minGpsAccuracyM: row.minGpsAccuracyM,
    minMoveM: row.minMoveM,
    maxJumpM: row.maxJumpM,
    maxSpeedMps: row.maxSpeedMps,
    parallelPassToleranceM: row.parallelPassToleranceM,
    headingTurnMinDeg: row.headingTurnMinDeg,
    headingTurnMaxDeg: row.headingTurnMaxDeg,
    autoStopDelayMs: row.autoStopDelayMs,
    travelConfidenceThreshold: row.travelConfidenceThreshold,
    harvestConfidenceThreshold: row.harvestConfidenceThreshold,
    possibleFieldHoldMs: row.possibleFieldHoldMs,
  }
}

async function ensureRow() {
    const db = copilotDb()
    const existing = await db.copilotSettings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return db.copilotSettings.create({
    data: {
      id: 1,
      ...DEFAULT_COPILOT_SETTINGS,
    },
  })
}

export async function GET(request: NextRequest) {
  const field = await requireFieldOperator(request)
  if ('error' in field) {
    const admin = await requireAdminViewer(request)
    if ('error' in admin) return admin.error
  }
  try {
    const row = await ensureRow()
    return NextResponse.json(toSettings(row))
  } catch (error) {
    console.error('Copilot settings GET', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminEditor(request)
  if ('error' in admin) return admin.error
  try {
    const body = (await request.json()) as Partial<CopilotSettings>
    await ensureRow()
    const row = await copilotDb().copilotSettings.update({
      where: { id: 1 },
      data: {
        machineName: body.machineName ?? DEFAULT_COPILOT_SETTINGS.machineName,
        cutterWidthM: Number(body.cutterWidthM ?? DEFAULT_COPILOT_SETTINGS.cutterWidthM),
        effectiveWidthM: Number(body.effectiveWidthM ?? DEFAULT_COPILOT_SETTINGS.effectiveWidthM),
        minHarvestKmh: Number(body.minHarvestKmh ?? DEFAULT_COPILOT_SETTINGS.minHarvestKmh),
        maxHarvestKmh: Number(body.maxHarvestKmh ?? DEFAULT_COPILOT_SETTINGS.maxHarvestKmh),
        travelSpeedKmh: Number(body.travelSpeedKmh ?? DEFAULT_COPILOT_SETTINGS.travelSpeedKmh),
        minGpsAccuracyM: Number(body.minGpsAccuracyM ?? DEFAULT_COPILOT_SETTINGS.minGpsAccuracyM),
        minMoveM: Number(body.minMoveM ?? DEFAULT_COPILOT_SETTINGS.minMoveM),
        maxJumpM: Number(body.maxJumpM ?? DEFAULT_COPILOT_SETTINGS.maxJumpM),
        maxSpeedMps: Number(body.maxSpeedMps ?? DEFAULT_COPILOT_SETTINGS.maxSpeedMps),
        parallelPassToleranceM: Number(body.parallelPassToleranceM ?? DEFAULT_COPILOT_SETTINGS.parallelPassToleranceM),
        headingTurnMinDeg: Number(body.headingTurnMinDeg ?? DEFAULT_COPILOT_SETTINGS.headingTurnMinDeg),
        headingTurnMaxDeg: Number(body.headingTurnMaxDeg ?? DEFAULT_COPILOT_SETTINGS.headingTurnMaxDeg),
        autoStopDelayMs: Number(body.autoStopDelayMs ?? DEFAULT_COPILOT_SETTINGS.autoStopDelayMs),
        travelConfidenceThreshold: Number(body.travelConfidenceThreshold ?? DEFAULT_COPILOT_SETTINGS.travelConfidenceThreshold),
        harvestConfidenceThreshold: Number(body.harvestConfidenceThreshold ?? DEFAULT_COPILOT_SETTINGS.harvestConfidenceThreshold),
        possibleFieldHoldMs: Number(body.possibleFieldHoldMs ?? DEFAULT_COPILOT_SETTINGS.possibleFieldHoldMs),
      },
    })
    return NextResponse.json(toSettings(row))
  } catch (error) {
    console.error('Copilot settings PUT', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
