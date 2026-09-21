import { NextRequest, NextResponse } from 'next/server'
import { requireAdminViewer } from '@/lib/field-auth'
import { loadOperatorHoldings } from '@/lib/payments/holdings'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdminViewer(request)
  if ('error' in admin) return admin.error

  try {
    const data = await loadOperatorHoldings()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Operator collections GET', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
