const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpecificBill() {
  try {
    console.log('Checking specific bill BILL-0015...');

    // Get bill BILL-0015 with rentals
    const bill = await prisma.bill.findFirst({
      where: { billNumber: 'BILL-0015' },
      include: {
        customer: true,
        rentals: {
          include: {
            payments: true
          }
        }
      }
    });

    if (!bill) {
      console.log('Bill BILL-0015 not found');
      return;
    }

    console.log(`Bill ID: ${bill.id}`);
    console.log(`Bill Number: ${bill.billNumber}`);
    console.log(`Total Amount: ${bill.totalAmount}`);
    console.log(`Paid Amount: ${bill.paidAmount}`);
    console.log(`Status: ${bill.status}`);

    console.log('\nRentals:');
    bill.rentals.forEach(rental => {
      console.log(`  Rental ${rental.id}: paidAmount=${rental.paidAmount}, payments count=${rental.payments.length}`);
    });

    const totalFromRentals = bill.rentals.reduce((sum, rental) => sum + (rental.paidAmount || 0), 0);
    console.log(`\nTotal paid from rentals: ${totalFromRentals}`);
    console.log(`Bill paidAmount matches: ${bill.paidAmount === totalFromRentals}`);

  } catch (error) {
    console.error('Error checking bill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificBill();
