import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

interface Star {
  x: number
  y: number
  r: number
  fase: number
  vel: number
}

interface Mota {
  x: number
  y: number
  r: number
  vy: number
  vida: number
}

/**
 * Fondo de estrellas titilantes y polvo dorado que asciende.
 * Con prefers-reduced-motion se dibuja un solo cuadro estático.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let w = 0
    let h = 0
    let stars: Star[] = []
    let motas: Mota[] = []
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round((w * h) / 9000)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.2,
        fase: Math.random() * Math.PI * 2,
        vel: Math.random() * 0.8 + 0.3,
      }))
      motas = Array.from({ length: Math.round(n / 8) }, () => nuevaMota(true))
    }

    const nuevaMota = (cualquierAltura = false): Mota => ({
      x: Math.random() * w,
      y: cualquierAltura ? Math.random() * h : h + 10,
      r: Math.random() * 1.4 + 0.4,
      vy: Math.random() * 0.25 + 0.08,
      vida: Math.random(),
    })

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const s = t / 1000
      for (const st of stars) {
        const a = reduce ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s * st.vel + st.fase))
        ctx.fillStyle = `rgba(237, 230, 246, ${a * 0.8})`
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const m of motas) {
        if (!reduce) {
          m.y -= m.vy
          m.x += Math.sin(s + m.vida * 10) * 0.08
          if (m.y < -10) Object.assign(m, nuevaMota())
        }
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(s * 1.5 + m.vida * 20))
        ctx.fillStyle = `rgba(212, 175, 55, ${a})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      draw(t)
      raf = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (reduce) draw(0)
      else raf = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else start()
    }

    resize()
    start()
    const onResize = () => {
      resize()
      if (reduce) draw(0)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduce])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
}
