import type { Vehicle } from '../lib/types.ts'

export function VehicleMedia({ vehicle }: { vehicle: Pick<Vehicle, 'name' | 'color' | 'image'> }) {
  if (vehicle.image) {
    return (
      <div className="vehicle-art">
        <img src={vehicle.image} alt={vehicle.name} />
      </div>
    )
  }
  return <CarArt color={vehicle.color} label={vehicle.name} />
}

export function CarArt({ color, label }: { color: string; label?: string }) {
  return (
    <div className="vehicle-art">
      <svg viewBox="0 0 320 135" role="img" aria-label={label ?? 'Illustrative vehicle silhouette'}>
        <ellipse cx="160" cy="112" rx="140" ry="9" fill="#87928e" opacity="0.3" />
        <path
          d="M25 91 L32 67 Q40 58 69 56 L105 25 Q119 18 143 18 H207 Q225 20 247 55 L285 68 Q301 74 301 93 L298 104 H24Z"
          fill={color || '#52645d'}
          stroke="#273439"
          strokeWidth="2"
        />
        <path d="M85 55 L114 30 H155 V55Z M163 30 H205 Q221 32 237 55 H163Z" fill="#d6e2e5" stroke="#46565d" />
        <path d="M33 74 H59 M271 75 H294" stroke="#f8f1cc" strokeWidth="6" strokeLinecap="round" />
        <circle cx="78" cy="102" r="22" fill="#263033" />
        <circle cx="78" cy="102" r="11" fill="#a9b3b7" />
        <circle cx="250" cy="102" r="22" fill="#263033" />
        <circle cx="250" cy="102" r="11" fill="#a9b3b7" />
      </svg>
    </div>
  )
}
