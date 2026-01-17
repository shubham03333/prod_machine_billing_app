const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateBillPaidAmounts() {
  try {
    console.log('Starting bill paid amount update...');

    // Get all bills with their rentals
    const bills = await prisma.bill.findMany({
      include: {
        rentals: true
      }
    });

    console.log(`Found ${bills.length} bills to update`);

    for (const bill of bills) {
      // Calculate total paid amount from all rentals in this bill
      const paidAmount = bill.rentals.reduce((sum, rental) => sum + (rental.paidAmount || 0), 0);
      const totalAmount = bill.rentals.reduce((sum, rental) => sum + rental.totalAmount, 0);

      // Determine status
      let status = 'UNPAID';
      if (paidAmount >= totalAmount) {
        status = 'PAID';
      } else if (paidAmount > 0) {
        status = 'PARTIALLY_PAID';
      }

      // Update the bill
      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount,
          status
        }
      });

      console.log(`Updated bill ${bill.billNumber}: paidAmount=${paidAmount}, status=${status}`);
    }

    console.log('Bill paid amount update completed successfully!');
  } catch (error) {
    console.error('Error updating bill paid amounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateBillPaidAmounts();
