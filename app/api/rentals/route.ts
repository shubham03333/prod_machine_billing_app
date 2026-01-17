import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function GET(request: NextRequest) {
  try {
    console.log('Fetching rentals...')
    const rentals = await prisma.rental.findMany({
      include: {
        customer: true,
        operator: true,
        payments: true,
        bill: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Parse timeSlots if they are stored as JSON strings
    const parsedRentals = rentals.map(rental => ({
      ...rental,
      timeSlots: rental.timeSlots ? (typeof rental.timeSlots === 'string' ? JSON.parse(rental.timeSlots) : rental.timeSlots) : null
    }))

    console.log('Rentals fetched successfully:', parsedRentals.length)

    return NextResponse.json(parsedRentals)
  } catch (error) {
    console.error('Get rentals error:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { machineType, unitType, quantity, acreage, pricePerUnit, totalAmount, description, customerName, customerContact, customerAddress, operatorId, date, dieselCost, maintenanceCost, operatorSalary, paidAmount, paymentMode, normalHourlyRate, breakerHourlyRate, timeSlots } = await request.json()

    if (!machineType || !unitType || !quantity || !pricePerUnit || !totalAmount || !customerName || !customerContact || !operatorId || !date) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const operator = await prisma.user.findUnique({
      where: { id: parseInt(operatorId) }
    })
    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 400 })
    }

    // Always create a new customer for each rental to prevent unintended associations
    const customer = await prisma.customer.create({
      data: {
        name: customerName,
        contactNumber: customerContact,
        address: customerAddress,
      }
    })

    const paid = parseFloat(paidAmount || 0)
    const total = parseFloat(totalAmount)
    let paymentStatus = 'UNPAID'
    if (paid > 0 && paid < total) {
      paymentStatus = 'PARTIALLY_PAID'
    } else if (paid >= total) {
      paymentStatus = 'PAID'
    }

    const rental = await prisma.rental.create({
      data: {
        machineType,
        unitType,
        quantity: parseFloat(quantity),
        acreage: acreage ? parseFloat(acreage) : null,
        pricePerUnit: parseFloat(pricePerUnit),
        totalAmount: total,
        description: description || null,
        customerId: customer.id,
        operatorId: parseInt(operatorId),
        date: new Date(date),
        dieselCost: parseFloat(dieselCost || 0),
        maintenanceCost: parseFloat(maintenanceCost || 0),
        operatorSalary: parseFloat(operatorSalary || 0),
        paidAmount: paid,
        paymentStatus,
        paymentMode: paymentMode || null,
        normalHourlyRate: normalHourlyRate ? parseFloat(normalHourlyRate) : null,
        breakerHourlyRate: breakerHourlyRate ? parseFloat(breakerHourlyRate) : null,
        timeSlots: timeSlots || undefined,
      },
      include: {
        customer: true,
        operator: true,
        payments: true
      }
    })

    // Create payment record if paid amount > 0
    if (paid > 0 && paymentMode) {
      await prisma.payment.create({
        data: {
          rentalId: rental.id,
          amount: paid,
          mode: paymentMode
        }
      })
    }

    // Create a bill for this rental
    const billCount = await prisma.bill.count();
    const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`;

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        customerId: customer.id,
        totalAmount: total,
        dueDate: new Date(date), // Set due date to rental date, can be modified later
        rentals: {
          connect: [{ id: rental.id }]
        }
      }
    });

    // Update rental to link it to the bill
    await prisma.rental.update({
      where: { id: rental.id },
      data: { billId: bill.id }
    });

    // Return rental with bill information
    const rentalWithBill = await prisma.rental.findUnique({
      where: { id: rental.id },
      include: {
        customer: true,
        operator: true,
        payments: true,
        bill: {
          include: {
            rentals: {
              select: {
                id: true,
                machineType: true,
                unitType: true,
                quantity: true,
                acreage: true,
                pricePerUnit: true,
                totalAmount: true,
                description: true,
                customerId: true,
                operatorId: true,
                date: true,
                dieselCost: true,
                maintenanceCost: true,
                operatorSalary: true,
                paidAmount: true,
                paymentStatus: true,
                paymentMode: true,
                normalHourlyRate: true,
                breakerHourlyRate: true,
                timeSlots: true,
                billId: true,
                createdAt: true,
                updatedAt: true,
                operator: true,
                payments: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(rentalWithBill, { status: 201 })
  } catch (error) {
    console.error('Create rental error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
