import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const operators = await prisma.user.findMany({
      where: { role: 'operator' },
      select: { id: true, name: true }
    })
    return NextResponse.json(operators)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 })
  }
}
