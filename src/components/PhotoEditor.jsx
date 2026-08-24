import { useEffect, useState } from 'react'

export default function PhotoEditor({ file, onCancel, onDone }) {
  const [src, setSrc] = useState(null)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [bw, setBw] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setSrc(reader.result)
    reader.readAsDataURL(file)
  }, [file])

  const filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)${bw ? ' grayscale(1)' : ''}`

  const rotate = () => setRotation((r) => (r + 90) % 360)

  const reset = () => {
    setBrightness(100); setContrast(100); setSaturation(100); setRotation(0); setBw(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const img = new Image()
      img.src = src
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })

      const MAX = 1600
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const rot = (rotation % 360) * Math.PI / 180
      const swap = rotation % 180 !== 0

      const canvas = document.createElement('canvas')
      canvas.width = swap ? h : w
      canvas.height = swap ? w : h
      const ctx = canvas.getContext('2d')
      ctx.filter = filter
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rot)
      ctx.drawImage(img, -w / 2, -h / 2, w, h)

      canvas.toBlob((blob) => onDone(blob, 'jpg'), 'image/jpeg', 0.9)
    } catch {
      alert('Не удалось обработать фото')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <h3>Редактор фото</h3>
          <button className="icon-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div className="editor-preview">
          {src && <img src={src} style={{ filter, transform: `rotate(${rotation}deg)` }} alt="" />}
        </div>

        <div className="editor-controls">
          <label>Яркость
            <input type="range" min="40" max="180" value={brightness} onChange={(e) => setBrightness(+e.target.value)} />
          </label>
          <label>Контраст
            <input type="range" min="40" max="180" value={contrast} onChange={(e) => setContrast(+e.target.value)} />
          </label>
          <label>Насыщенность
            <input type="range" min="0" max="220" value={saturation} onChange={(e) => setSaturation(+e.target.value)} />
          </label>
          <div className="editor-toggles">
            <button className={'btn-ghost small' + (bw ? ' toggled' : '')} onClick={() => setBw(!bw)}>Ч/Б</button>
            <button className="btn-ghost small" onClick={rotate}>Повернуть</button>
            <button className="btn-ghost small" onClick={reset}>Сброс</button>
          </div>
        </div>

        <div className="editor-actions">
          <button className="btn-ghost" onClick={onCancel}>Отмена</button>
          <button className="btn-primary" style={{ maxWidth: 180 }} onClick={apply} disabled={busy || !src}>
            {busy ? <span className="spinner" /> : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}
