import type { Vehicle } from './types.ts'

export function koboFromNaira(naira: number) {
  return Math.round(naira * 100)
}

export function nairaFromKobo(kobo: number) {
  return kobo / 100
}

export function money(kobo: number) {
  return `₦${nairaFromKobo(kobo).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

export function moneyShort(kobo: number) {
  const millions = nairaFromKobo(kobo) / 1_000_000
  const abs = Math.abs(millions).toFixed(2)
  return `${millions < 0 ? '-' : ''}₦${abs}m`
}

export function moneyCompact(kobo: number) {
  if (Math.abs(nairaFromKobo(kobo)) < 1_000_000) return money(kobo)
  return moneyShort(kobo)
}

export function km(value: number) {
  if (value <= 0) return 'Mileage not stated'
  return `${value.toLocaleString('en-NG')} km`
}

export function modelYear(year: number) {
  return year >= 1980 ? String(year) : 'Year not stated'
}

export function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(start: string, end: string) {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

export function stockAge(vehicle: Pick<Vehicle, 'acquiredOn' | 'availableOn' | 'ageFrom'>, today = todayISO()) {
  const start = vehicle.ageFrom === 'availability' ? vehicle.availableOn || vehicle.acquiredOn : vehicle.acquiredOn
  return Math.max(0, daysBetween(start, today))
}

export function prettyDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function greeting(name: string) {
  const hour = Number(
    new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hourCycle: 'h23' }),
  )
  if (!Number.isFinite(hour)) return `Hello, ${name}.`
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}.`
}

let sequence = 0

export function uid(prefix: string) {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}

export function contactKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function hay(row: object, query: string) {
  return Object.values(row).join(' ').toLowerCase().includes(query.trim().toLowerCase())
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
