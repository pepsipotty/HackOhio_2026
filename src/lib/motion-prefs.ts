const media = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches

export const prefersReducedMotion = (): boolean => media('(prefers-reduced-motion: reduce)')
export const isCoarsePointer = (): boolean => media('(pointer: coarse)')
export const isLowPower = (): boolean => (navigator.hardwareConcurrency ?? 8) <= 4
