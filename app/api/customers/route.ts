import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkReadOnlyGuard } from '@/lib/auth-guard'
import { requireAdminEditor, requireFieldOperator } from '@/lib/field-auth'

export async function GET(request: NextRequest) {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        rentals: {
          select: {
            totalAmount: true,
            date: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate revenue and other stats for each customer
    const customersWithStats = customers.map(customer => {
      const totalRevenue = customer.rentals.reduce((sum, rental) => sum + rental.totalAmount, 0)
      const totalRentals = customer.rentals.length
      const lastRentalDate = customer.rentals.length > 0
        ? new Date(Math.max(...customer.rentals.map(r => new Date(r.date).getTime())))
        : null

      return {
        ...customer,
        totalRevenue,
        totalRentals,
        lastRentalDate
      }
    })

    return NextResponse.json(customersWithStats)
  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const fieldAuth = await requireFieldOperator(request)
    const isField = !('error' in fieldAuth)
    if (!isField) {
      const denied = await checkReadOnlyGuard(request)
      if (denied) return denied
      const admin = await requireAdminEditor(request)
      if ('error' in admin) return admin.error
    }

    const { name, contactNumber, address } = await request.json()
    if (!name || !contactNumber) {
      return NextResponse.json({ error: 'Name and contact number are required' }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data: {
        name: String(name).trim(),
        contactNumber: String(contactNumber).trim(),
        address: address ? String(address).trim() : null,
      },
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const denied = await checkReadOnlyGuard(request)
    if (denied) return denied

    const { id, name, contactNumber, address } = await request.json()

    if (!id || !name || !contactNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
        name,
        contactNumber,
        address: address || null
      }
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = await checkReadOnlyGuard(request)
    if (denied) return denied

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
