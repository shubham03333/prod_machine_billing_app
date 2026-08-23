export const STANDARD_PRICES = {
  tractor: { hourly: 500, trip: 500, acre: 1500 },
  harvester: { hourly: 3000, trip: 3000, acre: 3000, guntha: 75 },
  excavator: { hourly: 1000, trip: 200, acre: 400, monthly: 0, work: 0 },
}

export function acreRateForMachine(machine: string): number {
  if (machine === 'harvester') return STANDARD_PRICES.harvester.acre
  if (machine === 'tractor') return STANDARD_PRICES.tractor.acre
  if (machine === 'excavator') return STANDARD_PRICES.excavator.acre
  return STANDARD_PRICES.harvester.acre
}

