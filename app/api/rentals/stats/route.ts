import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'today'

    const now = new Date()
    let whereClause = {}

    switch (filter) {
      case 'today':
        whereClause = {
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        }
        break
      case 'month':
        whereClause = {
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        }
        break
      case 'custom':
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        if (startDate && endDate) {
          whereClause = {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          }
        }
        break
    }

    const filteredRentals = await prisma.rental.findMany({
      where: whereClause,
      include: {
        operator: true
      }
    })

    const stats = {
      totalRevenue: filteredRentals.reduce((sum, r) => sum + r.totalAmount, 0),
      totalRentals: filteredRentals.length,
      machineStats: filteredRentals.reduce((acc, r) => {
        acc[r.machineType] = (acc[r.machineType] || 0) + r.totalAmount
        return acc
      }, {} as Record<string, number>),
      operatorStats: filteredRentals.reduce((acc, r) => {
        acc[r.operator.name] = (acc[r.operator.name] || 0) + r.totalAmount
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
