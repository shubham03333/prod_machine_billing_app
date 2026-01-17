const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    const bill = await prisma.bill.findUnique({
      where: { billNumber: 'BILL-0015' },
      include: { rentals: true }
    });

    console.log('Bill paidAmount:', bill.paidAmount);
    console.log('Rentals paidAmount sum:', bill.rentals.reduce((sum, r) => sum + (r.paidAmount || 0), 0));

    // Try to update the bill
    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { paidAmount: 2250, status: 'PAID' }
    });

    console.log('Updated bill paidAmount:', updated.paidAmount);
    console.log('Updated bill status:', updated.status);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
