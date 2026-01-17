import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name, contactNumber, address } = await request.json()

    if (!name || !contactNumber) {
      return NextResponse.json({ error: 'Name and contact number are required' }, { status: 400 })
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(params.id) },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.customer.delete({
      where: { id: parseInt(params.id) }
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
