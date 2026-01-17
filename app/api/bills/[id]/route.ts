import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/bills/[id] - Get a specific bill
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const billId = parseInt(params.id);

    if (isNaN(billId)) {
      return NextResponse.json(
        { error: 'Invalid bill ID' },
        { status: 400 }
      );
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
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
      }
    });

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Calculate accurate paidAmount from rental.paidAmount (since payments may not be recorded individually)
    const accuratePaidAmount = bill.rentals.reduce((sum, rental) => {
      return sum + (rental.paidAmount || 0);
    }, 0);

    // Update bill's paidAmount if it doesn't match
    if (bill.paidAmount !== accuratePaidAmount) {
      await prisma.bill.update({
        where: { id: billId },
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

    // Parse timeSlots JSON for each rental
    const billWithParsedTimeSlots = {
      ...bill,
      rentals: bill.rentals.map(rental => ({
        ...rental,
        timeSlots: rental.timeSlots ? (typeof rental.timeSlots === 'string' ? JSON.parse(rental.timeSlots) : rental.timeSlots) : []
      }))
    };

    return NextResponse.json(billWithParsedTimeSlots);
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

// PUT /api/bills/[id] - Update a bill
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const billId = parseInt(params.id);

    if (isNaN(billId)) {
      return NextResponse.json(
        { error: 'Invalid bill ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, paidAmount, dueDate } = body;

    // Check if bill exists
    const existingBill = await prisma.bill.findUnique({
      where: { id: billId }
    });

    if (!existingBill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Update bill
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
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

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json(
      { error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id] - Delete a bill
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const billId = parseInt(params.id);

    if (isNaN(billId)) {
      return NextResponse.json(
        { error: 'Invalid bill ID' },
        { status: 400 }
      );
    }

    // Check if bill exists
    const existingBill = await prisma.bill.findUnique({
      where: { id: billId }
    });

    if (!existingBill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Delete bill (rentals will be disconnected due to optional relation)
    await prisma.bill.delete({
      where: { id: billId }
    });

    return NextResponse.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}
