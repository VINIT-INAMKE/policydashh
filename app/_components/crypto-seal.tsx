'use client'

import { useEffect, useRef, useState } from 'react'

const HASH_DISPLAY = '0x882…F9A2'
const SCRAMBLE_CHARS = '0123456789abcdef'
// Deterministic seed bytes - render geometry is reproducible from these
const SEED_BYTES = [
  0x88, 0x2a, 0x4f, 0x9e, 0x2b, 0x1c, 0x83, 0xd5, 0xe8, 0xf0, 0xa2, 0xb6,
]

function scramble(target: string, settledChars: number): string {
  return target
    .split('')
    .map((c, i) => {
      if (i < settledChars) return c
      if (!/[0-9a-fA-FxX]/.test(c)) return c
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
    })
    .join('')
}

export function CryptoSeal() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Initialise the hash deterministically (HASH_DISPLAY itself) instead of
  // randomising during render. Math.random() at render time produces a
  // different string on the server vs the first client render, which makes
  // React's hydration diff see mismatched text in the `{hash}` slot and
  // throw error #418 in production. The scramble animation still kicks in
  // from the IntersectionObserver effect below.
  const [hash, setHash] = useState(HASH_DISPLAY)
  const [revealed, setRevealed] = useState(false)

  // Trigger scramble on intersect
  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setHash(HASH_DISPLAY)
      setRevealed(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true)
            obs.disconnect()
            break
          }
        }
      },
      { threshold: 0.35 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!revealed) return
    let frame = 0
    const total = 42
    const id = window.setInterval(() => {
      frame += 1
      const settled = Math.min(
        HASH_DISPLAY.length,
        Math.floor((frame / total) * HASH_DISPLAY.length),
      )
      setHash(scramble(HASH_DISPLAY, settled))
      if (frame >= total) {
        setHash(HASH_DISPLAY)
        window.clearInterval(id)
      }
    }, 38)
    return () => window.clearInterval(id)
  }, [revealed])

  // Canvas seal - concentric notched rings + animated dashed verification arc
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let t = 0
    let visible = true
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible && !reduceMotion) loop()
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      // On first paint the canvas can momentarily be 0×0 (before
      // ResizeObserver fires), which would make every derived radius
      // negative and CanvasRenderingContext2D.arc() throw IndexSizeError.
      // Bail out cleanly until the layout settles.
      if (w <= 0 || h <= 0) return
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const baseR = Math.min(w, h) * 0.28

      // Concentric notched rings - geometry derived from SEED_BYTES
      for (let ring = 0; ring < SEED_BYTES.length; ring++) {
        const r = baseR + ring * 5.5
        const byte = SEED_BYTES[ring]
        const segments = 96
        const dir = ring % 2 === 0 ? 1 : -1
        const phase = t * 0.00018 * dir
        ctx.beginPath()
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + phase
          const bit = (byte >> (i % 8)) & 1
          const notch = bit ? 2 : 0
          const wobble = Math.sin(angle * 6 + t * 0.0009 + ring) * 0.9
          const radius = r + notch + wobble
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const alpha = 0.06 + (ring / SEED_BYTES.length) * 0.18
        ctx.strokeStyle = `rgba(0, 10, 30, ${alpha})`
        ctx.lineWidth = 0.7
        ctx.stroke()
      }

      // Inner verification disc - clamp radius to 0 so a tiny canvas
      // (baseR < 8 means the seal is rendered <29px wide) can't throw.
      const innerR = Math.max(baseR - 8, 0)
      if (innerR > 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0, 33, 71, 0.35)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Center accent dot - green tertiary-fixed-dim
      const pulse = 0.65 + Math.sin(t * 0.0025) * 0.2
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(102, 221, 139, ${pulse})`
      ctx.fill()

      // Outer rotating dashed verification arc
      ctx.save()
      ctx.beginPath()
      ctx.setLineDash([3, 7])
      ctx.lineDashOffset = -t * 0.018
      ctx.arc(cx, cy, baseR + SEED_BYTES.length * 5.5 + 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 10, 30, 0.22)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    const loop = () => {
      draw()
      if (reduceMotion) return
      t += 16
      raf = requestAnimationFrame(loop)
    }

    if (reduceMotion) draw()
    else loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 lg:p-12">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-[0.6rem] uppercase tracking-widest text-[var(--cl-primary)] opacity-60">
              Block Hash
            </div>
            <div className="font-mono text-xs text-[var(--cl-primary)] font-bold tabular-nums">
              {hash}
            </div>
          </div>
          <span
            className="material-symbols-outlined text-[var(--cl-primary)] shrink-0"
            data-weight="fill"
          >
            verified
          </span>
        </div>
        <div className="flex justify-between items-end gap-4 text-[var(--cl-primary)]">
          <div className="space-y-1">
            <div className="text-[0.6rem] uppercase tracking-widest opacity-60">
              Sealed
            </div>
            <div className="font-mono text-[10px] opacity-80 tabular-nums">
              rev 0x882 · sig 14/21
            </div>
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[0.6rem] uppercase tracking-widest opacity-60">
              Status
            </div>
            <div className="font-mono text-[10px] opacity-80 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cl-tertiary-fixed-dim)] animate-pulse"></span>
              Validating
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
