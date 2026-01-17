<<<<<<< HEAD
export const dynamic = 'force-dynamic';
=======
>>>>>>> 704a47cb8ee7fd6dda01a9880d1058806fae34d8
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()

    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { pin }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
