import { prisma } from '@/lib/prisma'
import type { CopilotSettings } from '@/lib/copilot/types'

type SettingsRow = CopilotSettings & { id: number; updatedAt: Date }

type SessionRow = {
  id: number
  localUuid: string
}

type CopilotDb = {
  copilotSettings: {
    findUnique: (args: { where: { id: number } }) => Promise<SettingsRow | null>
    create: (args: { data: CopilotSettings & { id: number } }) => Promise<SettingsRow>
    update: (args: { where: { id: number }; data: CopilotSettings }) => Promise<SettingsRow>
  }
  copilotHarvestSession: {
    findMany: (args: {
      include?: {
        fieldOperator?: { select: { name: true; operatorId: true } }
        customer?: { select: { name: true; address: true } }
      }
      orderBy?: { createdAt: 'desc' }
      take?: number
    }) => Promise<unknown[]>
    upsert: (args: {
      where: { localUuid: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }) => Promise<SessionRow>
  }
  copilotGpsPoint: {
    deleteMany: (args: { where: { sessionId: number } }) => Promise<unknown>
    createMany: (args: {
      data: Array<{
        sessionId: number
        sequenceNumber: number
        latitude: number
        longitude: number
        accuracy: number
        speedKmh: number
        headingDeg: number
        timestamp: Date
      }>
    }) => Promise<unknown>
  }
}

/** Prisma client after `prisma generate`. Cast until the Windows engine file is not locked. */
export function copilotDb(): CopilotDb {
  return prisma as unknown as CopilotDb
}
