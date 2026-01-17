import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/bills - Get all bills with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (status) where.status = status;

    const bills = await prisma.bill.findMany({
      where,
      include: {
        customer: true,
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
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Sync paidAmount for each bill and parse timeSlots
    const billsWithParsedTimeSlots = await Promise.all(bills.map(async (bill) => {
      // Calculate accurate paidAmount from rental.paidAmount (since payments may not be recorded individually)
      const accuratePaidAmount = bill.rentals.reduce((sum, rental) => {
        return sum + (rental.paidAmount || 0);
      }, 0);

      // Update bill's paidAmount if it doesn't match
      if (bill.paidAmount !== accuratePaidAmount) {
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: accuratePaidAmount,
            status: accuratePaidAmount >= bill.totalAmount ? 'PAID' :
                    accuratePaidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
          }
        });
        bill.paidAmount = accuratePaidAmount;
        bill.status = accuratePaidAmount >= bill.totalAmount ? 'PAID' :
                      accuratePaidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      }

      return {
        ...bill,
        rentals: bill.rentals.map(rental => ({
          ...rental,
          timeSlots: rental.timeSlots ? (typeof rental.timeSlots === 'string' ? JSON.parse(rental.timeSlots) : rental.timeSlots) : []
        }))
      };
    }));

    const total = await prisma.bill.count({ where });

    return NextResponse.json({
      bills: billsWithParsedTimeSlots,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}

// POST /api/bills - Create a new bill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, rentalIds, dueDate } = body;

    if (!customerId || !rentalIds || !Array.isArray(rentalIds) || rentalIds.length === 0) {
      return NextResponse.json(
        { error: 'Customer ID and rental IDs are required' },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify all rentals exist and belong to the customer
    const rentals = await prisma.rental.findMany({
      where: {
        id: { in: rentalIds },
        customerId: customerId
      }
    });

    if (rentals.length !== rentalIds.length) {
      return NextResponse.json(
        { error: 'Some rentals not found or do not belong to the customer' },
        { status: 400 }
      );
    }

    // Check if any rentals are already billed
    const billedRentals = rentals.filter(rental => rental.billId);
    if (billedRentals.length > 0) {
      return NextResponse.json(
        { error: 'Some rentals are already associated with another bill' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = rentals.reduce((sum, rental) => sum + rental.totalAmount, 0);

    // Calculate total paid amount from rentals
    const paidAmount = rentals.reduce((sum, rental) => sum + (rental.paidAmount || 0), 0);

    // Determine bill status based on paid amount
    let status = 'UNPAID';
    if (paidAmount >= totalAmount) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIALLY_PAID';
    }

    // Generate bill number (you can customize this logic)
    const billCount = await prisma.bill.count();
    const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`;

    // Create bill in transaction
    const bill = await prisma.$transaction(async (tx) => {
      // Create the bill
      const newBill = await tx.bill.create({
        data: {
          billNumber,
          customerId,
          totalAmount,
          paidAmount,
          status,
          dueDate: dueDate ? new Date(dueDate) : null,
          rentals: {
            connect: rentalIds.map(id => ({ id }))
          }
        },
        include: {
          customer: true,
          rentals: {
            include: {
              operator: true,
              payments: true
            }
          }
        }
      });

      // Update rentals to link them to the bill
      await tx.rental.updateMany({
        where: { id: { in: rentalIds } },
        data: { billId: newBill.id }
      });

      return newBill;
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
