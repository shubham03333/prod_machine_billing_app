const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBillsFromRentals() {
  try {
    console.log('Starting bill creation from existing rentals...');

    // Get all rentals that don't have a billId
    const unbilledRentals = await prisma.rental.findMany({
      where: {
        billId: null
      },
      include: {
        customer: true,
        operator: true,
        payments: true
      }
    });

    console.log(`Found ${unbilledRentals.length} unbilled rentals`);

    if (unbilledRentals.length === 0) {
      console.log('No unbilled rentals found. All rentals already have bills.');
      return;
    }

    // Group rentals by customer for bill creation
    const rentalsByCustomer = {};
    unbilledRentals.forEach(rental => {
      if (!rentalsByCustomer[rental.customerId]) {
        rentalsByCustomer[rental.customerId] = [];
      }
      rentalsByCustomer[rental.customerId].push(rental);
    });

    console.log(`Grouped into ${Object.keys(rentalsByCustomer).length} customer groups`);

    let billsCreated = 0;

    for (const [customerId, rentals] of Object.entries(rentalsByCustomer)) {
      // Calculate total amount and paid amount for the bill
      const totalAmount = rentals.reduce((sum, rental) => sum + rental.totalAmount, 0);
      const paidAmount = rentals.reduce((sum, rental) => sum + (rental.paidAmount || 0), 0);

      // Determine bill status
      let status = 'UNPAID';
      if (paidAmount >= totalAmount) {
        status = 'PAID';
      } else if (paidAmount > 0) {
        status = 'PARTIALLY_PAID';
      }

      // Generate bill number
      const billCount = await prisma.bill.count();
      const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`;

      // Create bill
      const bill = await prisma.bill.create({
        data: {
          billNumber,
          customerId: parseInt(customerId),
          totalAmount,
          paidAmount,
          status,
          dueDate: new Date(), // Set current date as due date, can be modified later
          rentals: {
            connect: rentals.map(r => ({ id: r.id }))
          }
        }
      });

      // Update rentals to link them to the bill
      await prisma.rental.updateMany({
        where: {
          id: { in: rentals.map(r => r.id) }
        },
        data: { billId: bill.id }
      });

      console.log(`Created bill ${billNumber} for customer ${rentals[0].customer.name} with ${rentals.length} rentals, total: ₹${totalAmount}, paid: ₹${paidAmount}`);
      billsCreated++;
    }

    console.log(`Bill creation completed! Created ${billsCreated} bills from ${unbilledRentals.length} rentals.`);
  } catch (error) {
    console.error('Error creating bills from rentals:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBillsFromRentals();
