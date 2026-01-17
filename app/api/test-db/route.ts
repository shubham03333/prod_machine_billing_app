import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const userCount = await prisma.user.count()
    const rentalCount = await prisma.rental.count()
    const customerCount = await prisma.customer.count()
    const expenseCount = await prisma.expense.count()
    const billCount = await prisma.bill.count()

    return NextResponse.json({
      success: true,
      message: 'Database connection test successful',
      userCount,
      rentalCount,
      customerCount,
      expenseCount,
      billCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Database connection failed!',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
