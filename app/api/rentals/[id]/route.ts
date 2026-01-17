import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const rental = await prisma.rental.findUnique({
      where: { id },
      include: {
        operator: true,
        customer: true
      }
    })

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }

    return NextResponse.json(rental)
  } catch (error) {
    console.error('Get rental error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
      machineType,
      unitType,
      quantity,
      pricePerUnit,
      totalAmount,
      description,
      customerName,
      customerContact,
      customerAddress,
      dieselCost,
      maintenanceCost,
      operatorSalary,
      paidAmount,
      paymentStatus,
      paymentMode,
      additionalAmount,
      additionalPaymentMode,
      date,
      normalHourlyRate,
      breakerHourlyRate,
      timeSlots
    } = body

    if (!machineType || !unitType || !quantity || !pricePerUnit || !totalAmount ||
        !customerName || !customerContact || !customerAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate numeric fields
    const quantityNum = parseFloat(quantity)
    if (isNaN(quantityNum) || quantityNum < 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    const pricePerUnitNum = parseFloat(pricePerUnit)
    if (isNaN(pricePerUnitNum) || pricePerUnitNum < 0) {
      return NextResponse.json({ error: 'Invalid price per unit' }, { status: 400 })
    }

    const totalAmountNum = parseFloat(totalAmount)
    if (isNaN(totalAmountNum) || totalAmountNum < 0) {
      return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 })
    }

    const dieselCostNum = parseFloat(dieselCost || 0)
    if (isNaN(dieselCostNum) || dieselCostNum < 0) {
      return NextResponse.json({ error: 'Invalid diesel cost' }, { status: 400 })
    }

    const maintenanceCostNum = parseFloat(maintenanceCost || 0)
    if (isNaN(maintenanceCostNum) || maintenanceCostNum < 0) {
      return NextResponse.json({ error: 'Invalid maintenance cost' }, { status: 400 })
    }

    const operatorSalaryNum = parseFloat(operatorSalary || 0)
    if (isNaN(operatorSalaryNum) || operatorSalaryNum < 0) {
      return NextResponse.json({ error: 'Invalid operator salary' }, { status: 400 })
    }

    const paidAmountNum = parseFloat(paidAmount || 0)
    if (isNaN(paidAmountNum) || paidAmountNum < 0) {
      return NextResponse.json({ error: 'Invalid paid amount' }, { status: 400 })
    }

    const additionalNum = parseFloat(additionalAmount || 0)
    if (isNaN(additionalNum) || additionalNum < 0) {
      return NextResponse.json({ error: 'Invalid additional amount' }, { status: 400 })
    }

    const normalHourlyRateNum = parseFloat(normalHourlyRate || 0)
    if (normalHourlyRate && normalHourlyRate !== '' && (isNaN(normalHourlyRateNum) || normalHourlyRateNum < 0)) {
      return NextResponse.json({ error: 'Invalid normal hourly rate' }, { status: 400 })
    }

    const breakerHourlyRateNum = parseFloat(breakerHourlyRate || 0)
    if (breakerHourlyRate && breakerHourlyRate !== '' && (isNaN(breakerHourlyRateNum) || breakerHourlyRateNum < 0)) {
      return NextResponse.json({ error: 'Invalid breaker hourly rate' }, { status: 400 })
    }

    const rental = await prisma.rental.findUnique({
      where: { id },
      include: { customer: true }
    })

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }

    // Update customer info
    const updatedCustomer = await prisma.customer.update({
      where: { id: rental.customerId },
      data: {
        name: customerName,
        contactNumber: customerContact,
        address: customerAddress
      }
    })

    const updatedPaidAmount = paidAmountNum + additionalNum

    const updateData: any = {
      machineType,
      unitType,
      quantity: quantityNum,
      pricePerUnit: pricePerUnitNum,
      totalAmount: totalAmountNum,
      description: description || null,
      paidAmount: updatedPaidAmount,
      paymentStatus: paymentStatus || 'UNPAID',
      paymentMode: paymentMode || null,
      date: date ? new Date(date) : undefined
    }

    // Only update optional fields if they have valid values (not empty strings)
    if (dieselCost && dieselCost !== '') {
      updateData.dieselCost = dieselCostNum
    }
    if (maintenanceCost && maintenanceCost !== '') {
      updateData.maintenanceCost = maintenanceCostNum
    }
    if (operatorSalary && operatorSalary !== '') {
      updateData.operatorSalary = operatorSalaryNum
    }
    if (normalHourlyRate && normalHourlyRate !== '') {
      updateData.normalHourlyRate = parseFloat(normalHourlyRate)
    }
    if (breakerHourlyRate && breakerHourlyRate !== '') {
      updateData.breakerHourlyRate = parseFloat(breakerHourlyRate)
    }
    if (timeSlots) {
      updateData.timeSlots = JSON.stringify(timeSlots)
    }

    const updatedRental = await prisma.rental.update({
      where: { id },
      data: updateData,
      include: {
        operator: true,
        customer: true,
        payments: true
      }
    })

    // Create payment record for additional amount
    if (additionalNum > 0 && additionalPaymentMode) {
      await prisma.payment.create({
        data: {
          rentalId: id,
          amount: additionalNum,
          mode: additionalPaymentMode
        }
      })
    }

    // Update the first payment's mode to match the rental's paymentMode
    if (paymentMode) {
      const firstPayment = await prisma.payment.findFirst({
        where: { rentalId: id },
        orderBy: { id: 'asc' }
      })
      if (firstPayment) {
        await prisma.payment.update({
          where: { id: firstPayment.id },
          data: { mode: paymentMode }
        })
      }
    }

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

    return NextResponse.json(updatedRental)
  } catch (error) {
    console.error('Update rental error:', error)
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

    const rental = await prisma.rental.findUnique({
      where: { id }
    })

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }

    // Delete all payments associated with this rental first
    await prisma.payment.deleteMany({
      where: { rentalId: id }
    })

    // Get the rental before deleting to check if it's part of a bill
    const rentalToDelete = await prisma.rental.findUnique({
      where: { id }
    })

    await prisma.rental.delete({
      where: { id }
    })

    // Update bill's paidAmount if rental was part of a bill
    if (rentalToDelete?.billId) {
      const billRentals = await prisma.rental.findMany({
        where: { billId: rentalToDelete.billId }
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
        where: { id: rentalToDelete.billId },
        data: {
          paidAmount: billPaidAmount,
          status: billStatus
        }
      })
    }

    return NextResponse.json({ message: 'Rental deleted successfully' })
  } catch (error) {
    console.error('Delete rental error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
