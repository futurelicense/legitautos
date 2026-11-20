import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CircleGeometry,
  Color,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  SpotLight,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Vehicle } from '../lib/types.ts'

export type ShowroomHandle = {
  step: (direction: number) => void
}

type Props = {
  vehicles: Vehicle[]
  onActive: (vehicle: Vehicle) => void
  ref?: Ref<ShowroomHandle>
}

export function Showroom({ vehicles, onActive, ref }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onActiveRef = useRef(onActive)
  const vehiclesRef = useRef(vehicles)
  onActiveRef.current = onActive
  vehiclesRef.current = vehicles
  const signature = vehicles.map((vehicle) => `${vehicle.id}:${vehicle.image ?? ''}`).join('|')

  useImperativeHandle(ref, () => ({
    step(direction: number) {
      mountRef.current?.dispatchEvent(new CustomEvent('showroom-step', { detail: direction }))
    },
  }))

  useEffect(() => {
    const node = mountRef.current
    const stock = vehiclesRef.current.filter((vehicle) => vehicle.image)
    if (!node || stock.length === 0) return
    const el: HTMLDivElement = node

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new Scene()
    scene.background = new Color(0x101816)
    scene.fog = new Fog(0x101816, 9, 18)

    const camera = new PerspectiveCamera(32, 1, 0.1, 40)
    camera.position.set(0, 2.55, 8.1)
    camera.lookAt(0, 2.15, 0)

    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    el.appendChild(renderer.domElement)

    const floor = new Mesh(
      new CircleGeometry(12, 80),
      new MeshStandardMaterial({ color: 0x1a2420, metalness: 0.86, roughness: 0.28 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const ring = new Mesh(
      new RingGeometry(4.15, 4.22, 128),
      new MeshBasicMaterial({ color: 0xa68455, transparent: true, opacity: 0.85, side: 2 }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    scene.add(ring)

    scene.add(new HemisphereLight(0xf3ead8, 0x14201c, 0.7))
    scene.add(new AmbientLight(0xfff6ea, 0.35))
    const key = new SpotLight(0xf2d7a2, 8, 20, 0.5, 0.6, 1.5)
    key.position.set(2.4, 6.4, 4)
    scene.add(key, key.target)
    const rim = new SpotLight(0x9ad6b9, 4, 18, 0.7, 0.8, 1.5)
    rim.position.set(-4.2, 3.4, 3)
    rim.target.position.set(0, 1.4, 1.5)
    scene.add(rim, rim.target)

    const turntable = new Group()
    scene.add(turntable)
    const loader = new TextureLoader()
    const radius = 3.85
    const pickables: Mesh[] = []
    const cards: Group[] = []

    stock.forEach((vehicle, index) => {
      const angle = (index / stock.length) * Math.PI * 2
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const card = new Group()
      card.position.set(x, 1.42, z)
      card.rotation.y = angle
      card.userData.angle = angle

      const gold = new Mesh(
        new PlaneGeometry(2.14, 3.28),
        new MeshStandardMaterial({ color: 0xa68455, metalness: 0.72, roughness: 0.28, emissive: 0x3a2c14, emissiveIntensity: 0.35 }),
      )
      gold.position.z = -0.04
      const frame = new Mesh(
        new PlaneGeometry(2.04, 3.16),
        new MeshStandardMaterial({ color: 0x141414, metalness: 0.55, roughness: 0.4 }),
      )
      frame.position.z = -0.02
      const photoMaterial = new MeshBasicMaterial({ color: 0x24302c })
      const photo = new Mesh(new PlaneGeometry(1.92, 3.02), photoMaterial)
      loader.load(vehicle.image ?? '', (texture) => {
        texture.colorSpace = SRGBColorSpace
        texture.repeat.set(1, 0.64)
        texture.offset.set(0, 0.2)
        photoMaterial.map = texture
        photoMaterial.color.set(0xffffff)
        photoMaterial.needsUpdate = true
      })
      photo.userData.index = index
      card.add(gold, frame, photo)
      turntable.add(card)
      cards.push(card)
      pickables.push(photo)

      const shadow = new Mesh(
        new CircleGeometry(0.72, 32),
        new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.position.set(x, 0.025, z)
      turntable.add(shadow)
    })

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const world = new Vector3()
    let frame = 0
    let dragging = false
    let lastX = 0
    let moved = 0
    let velocity = 0
    let dwell = 0
    let target: number | null = null
    let active = -1

    function resize() {
      const width = el.clientWidth || 1
      const height = el.clientHeight || 1
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    function nearest() {
      let best = 0
      let bestZ = -Infinity
      cards.forEach((card, index) => {
        card.getWorldPosition(world)
        if (world.z > bestZ) {
          bestZ = world.z
          best = index
        }
      })
      return best
    }

    function approach(angle: number) {
      const base = turntable.rotation.y
      let next = angle
      while (next - base > Math.PI) next -= Math.PI * 2
      while (base - next > Math.PI) next += Math.PI * 2
      target = next
      velocity = 0
    }

    function step(direction: number) {
      const current = nearest()
      const next = (current + direction + cards.length) % cards.length
      const angle = cards[next]?.userData.angle
      if (typeof angle === 'number') approach(-angle)
    }

    function publishActive() {
      const index = nearest()
      if (index === active) return
      active = index
      const vehicle = vehiclesRef.current.filter((item) => item.image)[index]
      if (vehicle) onActiveRef.current(vehicle)
    }

    function tick() {
      if (!document.hidden) {
        if (target !== null) {
          let delta = target - turntable.rotation.y
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          turntable.rotation.y += delta * 0.08
          if (Math.abs(delta) < 0.002) {
            turntable.rotation.y = target
            target = null
          }
        } else if (!dragging) {
          velocity *= 0.94
          turntable.rotation.y += velocity
          if (Math.abs(velocity) < 0.0004) {
            dwell += 1
            if (!reduced && dwell > 220) {
              dwell = 0
              step(1)
            }
          } else {
            dwell = 0
          }
        }
        cards.forEach((card) => {
          card.getWorldPosition(world)
          const focus = MathUtils.clamp((world.z - 0.2) / 3.6, 0, 1)
          const scale = 0.72 + focus * 0.5
          card.scale.setScalar(scale)
        })
        publishActive()
        renderer.render(scene, camera)
      }
      frame = requestAnimationFrame(tick)
    }

    function onPointerDown(event: PointerEvent) {
      dragging = true
      target = null
      lastX = event.clientX
      moved = 0
      velocity = 0
      renderer.domElement.setPointerCapture(event.pointerId)
      el.focus()
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) return
      const dx = event.clientX - lastX
      lastX = event.clientX
      moved += Math.abs(dx)
      velocity = dx * 0.0045
      turntable.rotation.y += velocity
    }

    function onPointerUp(event: PointerEvent) {
      dragging = false
      if (moved > 8) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(pickables, false)[0]
      const index = hit?.object.userData.index
      const angle = typeof index === 'number' ? cards[index]?.userData.angle : undefined
      if (typeof angle === 'number') approach(-angle)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }

    function onStep(event: Event) {
      const direction = (event as CustomEvent<number>).detail
      if (direction === 1 || direction === -1) step(direction)
    }

    approach(0)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    el.addEventListener('keydown', onKey)
    el.addEventListener('showroom-step', onStep)
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('showroom-step', onStep)
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose())
        } else if (material) {
          const textured = material as MeshStandardMaterial
          textured.map?.dispose()
          material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
    // The stock list is read from a ref. The signature is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return (
    <div
      ref={mountRef}
      className="showroom"
      tabIndex={0}
      role="group"
      aria-label="Showroom. Drag to turn the floor, or use the left and right arrow keys."
    />
  )
}
