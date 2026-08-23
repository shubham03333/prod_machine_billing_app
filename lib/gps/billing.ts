import { prisma } from '@/lib/prisma'
import { APPROVAL_APPROVED } from '@/lib/gps/constants'

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
  if (measurement.approvalStatus !== APPROVAL_APPROVED) return null

  const rentalData = {
    machineType: measurement.machine,
    unitType: 'acre',
    quantity: measurement.areaAcre,
    acreage: measurement.areaAcre,
    pricePerUnit: measurement.ratePerAcre,
    totalAmount: measurement.amount,
    description: measurement.village
      ? `GPS field measurement — ${measurement.village}`
      : `GPS field measurement ${measurement.localUuid}`,
    customerId: measurement.customerId,
    operatorId: measurement.fieldOperator.linkedUserId,
    date: measurement.stoppedAt,
    paymentStatus: 'UNPAID',
  }

  if (measurement.rental) {
    await prisma.rental.update({
      where: { id: measurement.rental.id },
      data: rentalData,
    })
    if (measurement.rental.billId) {
      await prisma.bill.update({
        where: { id: measurement.rental.billId },
        data: { totalAmount: measurement.amount },
      })
    }
    return prisma.rental.findUnique({ where: { id: measurement.rental.id } })
  }

  const rental = await prisma.rental.create({
    data: {
      ...rentalData,
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

  return prisma.rental.findUnique({ where: { id: rental.id } })
}

export async function approveMeasurement(measurementId: number) {
  await prisma.gpsMeasurement.update({
    where: { id: measurementId },
    data: {
      approvalStatus: APPROVAL_APPROVED,
      approvedAt: new Date(),
    },
  })
  return ensureRentalForMeasurement(measurementId)
}
