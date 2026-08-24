import { NextRequest, NextResponse } from 'next/server'
import { copilotDb } from '@/lib/copilot/db'
import { requireAdminViewer } from '@/lib/field-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdminViewer(request)
  if ('error' in admin) return admin.error
  try {
    const rows = await copilotDb().copilotHarvestSession.findMany({
      include: {
        fieldOperator: { select: { name: true, operatorId: true } },
        customer: { select: { name: true, address: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Copilot sessions list', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
