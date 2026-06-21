import { useEffect, useState } from 'react'

export function useElementAspect(ref) {
  const [aspect, setAspect] = useState(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const updateAspect = () => {
      const rect = node.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const nextAspect = rect.width / rect.height
      setAspect(prev => (
        prev && Math.abs(prev - nextAspect) < 0.001 ? prev : nextAspect
      ))
    }

    updateAspect()

    if (!window.ResizeObserver) {
      window.addEventListener('resize', updateAspect)
      return () => window.removeEventListener('resize', updateAspect)
    }

    const observer = new window.ResizeObserver(updateAspect)
    observer.observe(node)
    window.addEventListener('resize', updateAspect)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateAspect)
    }
  })

  return aspect
}
