import { prisma } from '@/lib/prisma'

export async function ensureRentalForMeasurement(measurementId: number) {
  const measurement = await prisma.gpsMeasurement.findUnique({
    where: { id: measurementId },
    include: {
      fieldOperator: true,
      customer: true,
      rental: true,
    },
  })
  if (!measurement || measurement.status !== 'COMPLETED') return null
  if (measurement.rental) return measurement.rental

  const rental = await prisma.rental.create({
    data: {
      machineType: measurement.machine,
      unitType: 'acre',
      quantity: measurement.areaAcre,
      acreage: measurement.areaAcre,
      pricePerUnit: measurement.ratePerAcre,
      totalAmount: measurement.amount,
      description: `GPS field measurement ${measurement.localUuid}`,
      customerId: measurement.customerId,
      operatorId: measurement.fieldOperator.linkedUserId,
      date: measurement.stoppedAt,
      paymentStatus: 'UNPAID',
      gpsMeasurementId: measurement.id,
    },
  })

  const billCount = await prisma.bill.count()
  const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`
  const bill = await prisma.bill.create({
    data: {
      billNumber,
      customerId: measurement.customerId,
      totalAmount: measurement.amount,
      paidAmount: 0,
      status: 'UNPAID',
    },
  })

  await prisma.rental.update({
    where: { id: rental.id },
    data: { billId: bill.id },
  })

  return rental
}
