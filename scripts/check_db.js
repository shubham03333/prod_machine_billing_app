const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database counts...');

    const userCount = await prisma.user.count();
    const rentalCount = await prisma.rental.count();
    const customerCount = await prisma.customer.count();
    const expenseCount = await prisma.expense.count();
    const billCount = await prisma.bill.count();

    console.log('Database counts:');
    console.log(`Users: ${userCount}`);
    console.log(`Rentals: ${rentalCount}`);
    console.log(`Customers: ${customerCount}`);
    console.log(`Expenses: ${expenseCount}`);
    console.log(`Bills: ${billCount}`);

    // Check unbilled rentals
    const unbilledRentals = await prisma.rental.findMany({
      where: {
        billId: null
      }
    });

    console.log(`Unbilled rentals: ${unbilledRentals.length}`);

    if (unbilledRentals.length > 0) {
      console.log('Sample unbilled rentals:');
      unbilledRentals.slice(0, 3).forEach(rental => {
        console.log(`- ID: ${rental.id}, Customer: ${rental.customerId}, Amount: ${rental.totalAmount}`);
      });
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
