import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rentalId = parseInt(params.id)

    if (isNaN(rentalId)) {
      return NextResponse.json({ error: 'Invalid rental ID' }, { status: 400 })
    }

    const { amount, mode } = await request.json()

    if (!amount || !mode) {
      return NextResponse.json({ error: 'Amount and mode are required' }, { status: 400 })
    }

    const allowedModes = ['Cash', 'Online', 'Cheque', 'UPI']
    if (!allowedModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 })
    }

    const rental = await prisma.rental.findUnique({
      where: { id: rentalId }
    })

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        rentalId,
        amount: parseFloat(amount),
        mode
      }
    })

    // Update rental's paidAmount and paymentStatus
    const newPaidAmount = rental.paidAmount + parseFloat(amount)
    let newPaymentStatus = 'PARTIALLY_PAID'
    if (newPaidAmount >= rental.totalAmount) {
      newPaymentStatus = 'PAID'
    }

    const updatedRental = await prisma.rental.update({
      where: { id: rentalId },
      data: {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus
      },
      include: {
        customer: true,
        operator: true,
        payments: true,
        bill: true
      }
    })

    // Update bill's paidAmount if rental is part of a bill
    if (updatedRental.billId) {
      const billRentals = await prisma.rental.findMany({
        where: { billId: updatedRental.billId }
      })

      const billPaidAmount = billRentals.reduce((sum, r) => sum + (r.paidAmount || 0), 0)
      const billTotalAmount = billRentals.reduce((sum, r) => sum + r.totalAmount, 0)

      let billStatus = 'UNPAID'
      if (billPaidAmount >= billTotalAmount) {
        billStatus = 'PAID'
      } else if (billPaidAmount > 0) {
        billStatus = 'PARTIALLY_PAID'
      }

      await prisma.bill.update({
        where: { id: updatedRental.billId },
        data: {
          paidAmount: billPaidAmount,
          status: billStatus
        }
      })
    }

    return NextResponse.json({ payment, rental: updatedRental }, { status: 201 })
  } catch (error) {
    console.error('Add payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
