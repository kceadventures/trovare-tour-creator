"use client"

import { useReducedMotion } from "motion/react"

export const spring = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 25 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 200, damping: 24 },
  exit:   { type: "spring" as const, stiffness: 300, damping: 35 },
}

export const staggerContainer = (staggerMs = 0.04) => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerMs } },
})

export const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

export function useSpring() {
  const reduced = useReducedMotion()
  if (reduced) {
    const instant = { duration: 0 }
    return { snappy: instant, smooth: instant, gentle: instant, exit: instant }
  }
  return spring
}
