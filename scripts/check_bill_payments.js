const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBillPayments() {
  try {
    console.log('Checking bill payments...');

    // Get all bills with rentals and payments
    const bills = await prisma.bill.findMany({
      include: {
        rentals: {
          include: {
            payments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5 // Check first 5 bills
    });

    console.log(`Found ${bills.length} bills`);

    for (const bill of bills) {
      console.log(`\nBill ${bill.billNumber}:`);
      console.log(`  Total Amount: ${bill.totalAmount}`);
      console.log(`  Paid Amount: ${bill.paidAmount}`);
      console.log(`  Status: ${bill.status}`);

      let totalPaymentsFromRentals = 0;
      bill.rentals.forEach(rental => {
        console.log(`  Rental ${rental.id}: paidAmount=${rental.paidAmount}, payments count=${rental.payments.length}`);
        rental.payments.forEach(payment => {
          console.log(`    Payment: ${payment.amount} (${payment.mode})`);
        });
        totalPaymentsFromRentals += rental.payments.reduce((sum, p) => sum + p.amount, 0);
      });

      console.log(`  Total payments from rentals: ${totalPaymentsFromRentals}`);
      console.log(`  Match: ${bill.paidAmount === totalPaymentsFromRentals ? 'YES' : 'NO'}`);
    }

  } catch (error) {
    console.error('Error checking bill payments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBillPayments();
