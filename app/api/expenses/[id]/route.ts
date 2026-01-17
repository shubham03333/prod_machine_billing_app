import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      description,
      amount,
      dieselCost,
      maintenanceCost,
      operatorSalary,
      date,
      operatorId
    } = body

    if (!description || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const expense = await prisma.expense.findUnique({
      where: { id }
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        description,
        amount: parseFloat(amount),
        dieselCost: dieselCost ? parseFloat(dieselCost) : undefined,
        maintenanceCost: maintenanceCost ? parseFloat(maintenanceCost) : undefined,
        operatorSalary: operatorSalary ? parseFloat(operatorSalary) : undefined,
        date: date ? new Date(date) : undefined,
        operatorId: operatorId ? parseInt(operatorId) : undefined
      },
      include: {
        operator: true
      }
    })

    return NextResponse.json(updatedExpense)
  } catch (error) {
    console.error('Update expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const expense = await prisma.expense.findUnique({
      where: { id }
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    await prisma.expense.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
