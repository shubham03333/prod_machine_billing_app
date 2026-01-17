import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        operator: true
      },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json(expenses)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, amount, operatorId, category, dieselCost, maintenanceCost, operatorSalary, driverDrinkCost, date } = body

    if (!description || !amount || !operatorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const parsedOperatorId = parseInt(operatorId)
    if (isNaN(parsedOperatorId)) {
      return NextResponse.json({ error: 'Invalid operator ID' }, { status: 400 })
    }

    const operator = await prisma.user.findUnique({
      where: { id: parsedOperatorId }
    })
    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 400 })
    }

    const expenseDate = date ? new Date(date) : new Date()

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: parsedAmount,
        operatorId: parsedOperatorId,
        category: category || null,
        date: expenseDate,
        dieselCost: parseFloat(dieselCost || 0) || 0,
        maintenanceCost: parseFloat(maintenanceCost || 0) || 0,
        operatorSalary: parseFloat(operatorSalary || 0) || 0,
        driverDrinkCost: parseFloat(driverDrinkCost || 0) || 0,
      },
      include: {
        operator: true
      }
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error saving expense:', error)
    return NextResponse.json({ error: 'Failed to save expense' }, { status: 500 })
  }
}
