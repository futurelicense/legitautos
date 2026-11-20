import type { Vehicle } from './types.ts'

export function tally(labels: string[]) {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts.entries()].map(([label, value]) => ({ id: label, label, value }))
}

export function ageBand(age: number, threshold: number) {
  if (age <= 30) return '0–30 days'
  if (age <= 60) return '31–60 days'
  if (age <= threshold) return `61–${threshold} days`
  return `Past ${threshold} days`
}

export function priceBand(kobo: number) {
  if (kobo <= 0) return 'Price not stated'
  const naira = kobo / 100
  if (naira < 40_000_000) return 'Under ₦40m'
  if (naira < 80_000_000) return '₦40–80m'
  if (naira < 150_000_000) return '₦80–150m'
  return '₦150m and over'
}

export function askingSum(vehicles: Vehicle[]) {
  return vehicles.reduce((sum, vehicle) => sum + (vehicle.price > 0 ? vehicle.price : 0), 0)
}
