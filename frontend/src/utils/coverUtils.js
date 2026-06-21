export const COVER_COLORS = [
  { value: '', gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
  { value: 'blue', gradient: 'linear-gradient(135deg, #2563eb, #0ea5e9)' },
  { value: 'cyan', gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)' },
  { value: 'teal', gradient: 'linear-gradient(135deg, #0d9488, #14b8a6)' },
  { value: 'green', gradient: 'linear-gradient(135deg, #16a34a, #22c55e)' },
  { value: 'orange', gradient: 'linear-gradient(135deg, #ea580c, #f97316)' },
  { value: 'red', gradient: 'linear-gradient(135deg, #dc2626, #ef4444)' },
  { value: 'pink', gradient: 'linear-gradient(135deg, #db2777, #ec4899)' },
  { value: 'purple', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
  { value: 'slate', gradient: 'linear-gradient(135deg, #475569, #64748b)' },
  { value: 'rose', gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)' },
  { value: 'amber', gradient: 'linear-gradient(135deg, #d97706, #f59e0b)' },
]

export function getCoverGradient(coverColor) {
  const found = COVER_COLORS.find(c => c.value === coverColor)
  return found ? found.gradient : COVER_COLORS[0].gradient
}

export function clampPercent(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

export function getImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

export function getCoverPositionPercentages(cropArea) {
  if (!cropArea) return { x: 50, y: 42 }

  const width = clampPercent(cropArea.width, 1, 100)
  const height = clampPercent(cropArea.height, 1, 100)
  const maxX = Math.max(0, 100 - width)
  const maxY = Math.max(0, 100 - height)
  const x = clampPercent(cropArea.x, 0, maxX)
  const y = clampPercent(cropArea.y, 0, maxY)

  return {
    x: maxX === 0 ? 50 : (x / maxX) * 100,
    y: maxY === 0 ? 50 : (y / maxY) * 100,
  }
}

function getCoverBaseVisibleArea(imageAspect, containerAspect) {
  if (!imageAspect || !containerAspect) return { width: 100, height: 100 }

  if (containerAspect > imageAspect) {
    return {
      width: 100,
      height: clampPercent((imageAspect / containerAspect) * 100, 1, 100),
    }
  }

  return {
    width: clampPercent((containerAspect / imageAspect) * 100, 1, 100),
    height: 100,
  }
}

function getCoverZoomFromCropArea(cropArea, imageAspect) {
  if (!cropArea || !imageAspect) return 1

  const width = clampPercent(cropArea.width, 1, 100)
  const height = clampPercent(cropArea.height, 1, 100)
  const cropAspect = (width / height) * imageAspect
  const baseArea = getCoverBaseVisibleArea(imageAspect, cropAspect)
  const zoomX = baseArea.width / width
  const zoomY = baseArea.height / height

  return Math.max(1, Math.min(3, (zoomX + zoomY) / 2))
}

export function getCoverVisibleArea(cropArea, imageAspect, containerAspect) {
  const baseArea = getCoverBaseVisibleArea(imageAspect, containerAspect)
  const zoom = getCoverZoomFromCropArea(cropArea, imageAspect)

  return {
    width: clampPercent(baseArea.width / zoom, 1, 100),
    height: clampPercent(baseArea.height / zoom, 1, 100),
  }
}

export function getCoverBackground(cropArea, imageAspect, containerAspect) {
  if (!cropArea || !imageAspect || !containerAspect) {
    return { position: 'center 42%', size: 'cover' }
  }

  const position = getCoverPositionPercentages(cropArea)
  const visibleArea = getCoverVisibleArea(cropArea, imageAspect, containerAspect)

  return {
    position: `${position.x}% ${position.y}%`,
    size: `${10000 / visibleArea.width}% auto`,
  }
}
