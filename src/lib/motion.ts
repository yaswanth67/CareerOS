'use client'

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'

// ============================================
// SPRING PHYSICS UTILITIES
// ============================================

export interface SpringConfig {
  stiffness: number
  damping: number
  mass?: number
}

export const springPresets = {
  gentle: { stiffness: 120, damping: 14 },
  smooth: { stiffness: 180, damping: 16 },
  snappy: { stiffness: 280, damping: 20 },
  bouncy: { stiffness: 300, damping: 10 },
  stiff: { stiffness: 400, damping: 25 },
} as const satisfies Record<string, SpringConfig>

export function createSpringAnimation(
  config: SpringConfig = springPresets.smooth
): string {
  // Convert spring config to CSS cubic-bezier approximation
  // This is a simplified mapping - for true spring physics, use a library
  const { stiffness, damping } = config
  const dampingRatio = damping / (2 * Math.sqrt(stiffness))

  if (dampingRatio >= 1) {
    // Overdamped - use ease-out
    return 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  } else if (dampingRatio > 0.5) {
    // Slightly underdamped - smooth
    return 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  } else {
    // Underdamped - bouncy
    return 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
}

// ============================================
// STAGGER UTILITIES
// ============================================

export interface StaggerConfig {
  delay: number // base delay in ms
  stagger: number // delay between each item in ms
  maxDelay?: number // cap the maximum delay
  direction?: 'normal' | 'reverse'
}

export function getStaggerDelay(
  index: number,
  config: StaggerConfig
): number {
  const { delay, stagger, maxDelay, direction = 'normal' } = config
  const calculatedDelay = delay + (direction === 'reverse' ? -index * stagger : index * stagger)
  return maxDelay ? Math.min(calculatedDelay, maxDelay) : calculatedDelay
}

export function generateStaggerStyles(
  count: number,
  config: StaggerConfig
): Array<{ animationDelay: string; animationFillMode: 'both' | 'forwards' }> {
  return Array.from({ length: count }, (_, i) => ({
    animationDelay: `${getStaggerDelay(i, config)}ms`,
    animationFillMode: 'both' as const,
  }))
}

// ============================================
// ANIMATION VARIANTS (Framer Motion style)
// ============================================

export interface AnimationVariants {
  hidden?: Record<string, string | number>
  visible?: Record<string, string | number>
  exit?: Record<string, string | number>
  hover?: Record<string, string | number>
  tap?: Record<string, string | number>
  focus?: Record<string, string | number>
}

export const fadeIn: AnimationVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const fadeOut: AnimationVariants = {
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

export const slideUp: AnimationVariants = {
  hidden: { opacity: 0, transform: 'translateY(20px)' },
  visible: { opacity: 1, transform: 'translateY(0)' },
  exit: { opacity: 0, transform: 'translateY(-20px)' },
}

export const slideDown: AnimationVariants = {
  hidden: { opacity: 0, transform: 'translateY(-20px)' },
  visible: { opacity: 1, transform: 'translateY(0)' },
  exit: { opacity: 0, transform: 'translateY(20px)' },
}

export const slideInRight: AnimationVariants = {
  hidden: { opacity: 0, transform: 'translateX(30px)' },
  visible: { opacity: 1, transform: 'translateX(0)' },
  exit: { opacity: 0, transform: 'translateX(30px)' },
}

export const slideInLeft: AnimationVariants = {
  hidden: { opacity: 0, transform: 'translateX(-30px)' },
  visible: { opacity: 1, transform: 'translateX(0)' },
  exit: { opacity: 0, transform: 'translateX(-30px)' },
}

export const scaleIn: AnimationVariants = {
  hidden: { opacity: 0, transform: 'scale(0.95)' },
  visible: { opacity: 1, transform: 'scale(1)' },
  exit: { opacity: 0, transform: 'scale(0.95)' },
}

export const scaleUp: AnimationVariants = {
  visible: { transform: 'scale(1)' },
  hover: { transform: 'scale(1.02)' },
  tap: { transform: 'scale(0.98)' },
}

export const lift: AnimationVariants = {
  visible: { transform: 'translateY(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  hover: { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.15)' },
}

export const cardEntrance: AnimationVariants = {
  hidden: { opacity: 0, transform: 'translateY(20px) scale(0.98)' },
  visible: { opacity: 1, transform: 'translateY(0) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(-10px) scale(0.98)' },
}

export const shimmer: AnimationVariants = {
  visible: { backgroundPosition: '200% 0' },
}

// ============================================
// TRANSITION PRESETS
// ============================================

export interface TransitionConfig {
  duration?: number
  ease?: string
  delay?: number
  type?: 'tween' | 'spring'
  stiffness?: number
  damping?: number
}

export const transitions = {
  instant: { duration: 0 },
  fast: { duration: 150, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  normal: { duration: 200, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  smooth: { duration: 300, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  slow: { duration: 500, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  spring: { type: 'spring', stiffness: 300, damping: 20 },
  springGentle: { type: 'spring', stiffness: 120, damping: 14 },
  springBouncy: { type: 'spring', stiffness: 300, damping: 10 },
  springStiff: { type: 'spring', stiffness: 400, damping: 25 },
} as const satisfies Record<string, TransitionConfig>

// ============================================
// HOOKS
// ============================================

/**
 * Hook for staggered entrance animations
 */
export function useStaggeredAnimation(
  itemCount: number,
  config: StaggerConfig = { delay: 0, stagger: 80, maxDelay: 600 }
) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const timeouts: NodeJS.Timeout[] = []

    for (let i = 0; i < itemCount; i++) {
      const delay = getStaggerDelay(i, config)
      const timeout = setTimeout(() => {
        if (mountedRef.current) {
          setVisibleItems(prev => new Set([...prev, i]))
        }
      }, delay)
      timeouts.push(timeout)
    }

    return () => {
      mountedRef.current = false
      timeouts.forEach(t => clearTimeout(t))
    }
  }, [itemCount, config.delay, config.stagger, config.maxDelay])

  const isVisible = useCallback((index: number) => visibleItems.has(index), [visibleItems])

  return { isVisible, visibleCount: visibleItems.size }
}

/**
 * Hook for reduced motion preference
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

/**
 * matchMedia is an external store, so it is read with useSyncExternalStore
 * rather than mirrored into state from an effect. The effect version rendered
 * once with the wrong value and then set state synchronously to correct it —
 * a cascading render, and a flash of animation for someone who asked for none.
 * The server snapshot is `false`: there is no media query while rendering on
 * the server, and the client corrects on hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  )
}

/**
 * Hook for spring-based value animation
 */
export function useSpringValue(
  target: number,
  config: SpringConfig = springPresets.smooth
): number {
  const [value, setValue] = useState(target)
  // React 19's useRef requires an explicit initial value.
  const rafRef = useRef<number | undefined>(undefined)
  const velocityRef = useRef(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    // No spring to run — the return below already reports `target` directly
    // while reduced motion is on, so syncing state here would only be a
    // cascading render.
    if (reducedMotion) return

    const { stiffness, damping, mass = 1 } = config
    let currentValue = value
    let currentVelocity = velocityRef.current

    const animate = () => {
      const displacement = currentValue - target
      const springForce = -stiffness * displacement
      const dampingForce = -damping * currentVelocity
      const acceleration = (springForce + dampingForce) / mass

      currentVelocity += acceleration * (16 / 1000) // ~60fps
      currentValue += currentVelocity * (16 / 1000)

      setValue(currentValue)

      // Stop when close to target and velocity is low
      if (Math.abs(displacement) < 0.01 && Math.abs(currentVelocity) < 0.01) {
        setValue(target)
        velocityRef.current = 0
        return
      }

      velocityRef.current = currentVelocity
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, config.stiffness, config.damping, reducedMotion])

  return reducedMotion ? target : value
}

// ============================================
// CSS CLASS GENERATORS
// ============================================

/**
 * Generate CSS classes for entrance animations with stagger
 */
export function createEntranceClasses(
  baseClass: string,
  variants: AnimationVariants,
  transition: TransitionConfig = transitions.smooth
): string {
  const { duration = 300, ease = 'cubic-bezier(0.4, 0, 0.2, 1)', delay = 0 } = transition

  return `
    .${baseClass} {
      opacity: 0;
      animation: ${baseClass}-enter ${duration}ms ${ease} ${delay}ms forwards;
    }
    @keyframes ${baseClass}-enter {
      from { ${Object.entries(variants.hidden || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')} }
      to { ${Object.entries(variants.visible || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')} }
    }
  `
}

/**
 * Get transition CSS string from config
 */
export function getTransitionCSS(config: TransitionConfig): string {
  const { duration = 200, ease = 'cubic-bezier(0.4, 0, 0.2, 1)', delay = 0 } = config
  return `all ${duration}ms ${ease} ${delay}ms`
}

// ============================================
// MOTION COMPONENTS HELPERS
// ============================================

/**
 * CSS-in-JS style object for applying variants
 */
export function applyVariant(
  element: HTMLElement,
  variant: Record<string, string | number>,
  transition?: TransitionConfig
) {
  Object.assign(element.style, variant)
  if (transition) {
    element.style.transition = getTransitionCSS(transition)
  }
}

/**
 * Shake animation for validation errors
 */
export const shakeAnimation = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  }
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
`

/**
 * Pulse animation for loading states
 */
export const pulseAnimation = `
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .animate-pulse-ring {
    animation: pulse-ring 1.5s ease-out infinite;
  }
`

/**
 * Morphing blob animation for loading
 */
export const blobAnimation = `
  @keyframes blob {
    0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
    25% { border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%; }
    50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    75% { border-radius: 60% 40% 60% 40% / 40% 60% 60% 40%; }
  }
  .animate-blob {
    animation: blob 8s ease-in-out infinite;
  }
`