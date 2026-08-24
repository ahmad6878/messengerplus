import { useEffect, useRef, useState } from 'react'

const MAX_PREVIEW_W = 460
const MAX_PREVIEW_H = 320
const MAX_OUT = 1600

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#38bdf8', '#ffffff', '#111111']

export default function PhotoEditor({ file, onCancel, onDone }) {
  const [src, setSrc] = useState(null)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [bw, setBw] = useState(false)
  const [mode, setMode] = useState('adjust') // adjust | crop | draw
  const [crop, setCrop] = useState(null) // {x,y,w,h} 0..1
  const [color, setColor] = useState(COLORS[0])
  const [brush, setBrush] = useState(5)
  const [busy, setBusy] = useState(false)
  const [, forceRender] = useState(0)

  const imgRef = useRef(null)
  const previewRef = useRef(null)
  const drawRef = useRef(null)
  const strokesRef = useRef([])
  const drawingRef = useRef(null)
  const cropStartRef = useRef(null)

  const filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)${bw ? ' grayscale(1)' : ''}`

  // загрузка изображения
  useEffect(() => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => { img.src = reader.result; setSrc(reader.result) }
    img.onload = () => { imgRef.current = img; renderPreview() }
    reader.readAsDataURL(file)
  }, [file])

  // перерисовка при изменении параметров
  useEffect(() => {
    if (imgRef.current) { renderPreview(); redrawStrokes() }
  }, [brightness, contrast, saturation, bw, rotation, src])

  const renderPreview = () => {
    const img = imgRef.current
    const cv = previewRef.current
    if (!img || !cv) return
    const iw = img.naturalWidth, ih = img.naturalHeight
    const swap = rotation % 180 !== 0
    const k = Math.min(MAX_PREVIEW_W / (swap ? ih : iw), MAX_PREVIEW_H / (swap ? iw : ih), 1)
    cv.width = Math.round((swap ? ih : iw) * k)
    cv.height = Math.round((swap ? iw : ih) * k)
    const ctx = cv.getContext('2d')
    ctx.filter = filter
    ctx.translate(cv.width / 2, cv.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
  }

  const redrawStrokes = (inProgress) => {
    const cv = drawRef.current
    const p = previewRef.current
    if (!cv || !p) return
    cv.width = p.width
    cv.height = p.height
    const ctx = cv.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const all = inProgress ? [...strokesRef.current, inProgress] : strokesRef.current
    for (const s of all) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = Math.max(1.5, s.size * cv.width)
      ctx.beginPath()
      s.points.forEach((pt, i) => {
        const x = pt.x * cv.width
        const y = pt.y * cv.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (s.points.length === 1) {
        ctx.arc(s.points[0].x * cv.width, s.points[0].y * cv.height, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.fill()
      }
      ctx.stroke()
    }
  }

  const rotate = () => {
    setCrop(null)
    strokesRef.current = []
    setRotation((r) => (r + 90) % 360)
  }

  const reset = () => {
    setBrightness(100); setContrast(100); setSaturation(100); setRotation(0); setBw(false)
    setCrop(null); strokesRef.current = []; forceRender((v) => v + 1)
  }

  const undo = () => {
    strokesRef.current.pop()
    redrawStrokes()
    forceRender((v) => v + 1)
  }

  const clearDrawing = () => {
    strokesRef.current = []
    redrawStrokes()
    forceRender((v) => v + 1)
  }

  // ---------- указатель ----------
  const getPos = (e) => {
    const r = drawRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  const onPointerDown = (e) => {
    if (mode === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      drawingRef.current = { color, size: brush / 500, points: [getPos(e)] }
      redrawStrokes(drawingRef.current)
    } else if (mode === 'crop') {
      e.currentTarget.setPointerCapture(e.pointerId)
      cropStartRef.current = getPos(e)
      setCrop({ ...cropStartRef.current, w: 0, h: 0 })
    }
  }

  const onPointerMove = (e) => {
    if (mode === 'draw' && drawingRef.current) {
      drawingRef.current.points.push(getPos(e))
      redrawStrokes(drawingRef.current)
    } else if (mode === 'crop' && cropStartRef.current) {
      const p = getPos(e)
      const s = cropStartRef.current
      setCrop({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      })
    }
  }

  const onPointerUp = () => {
    if (mode === 'draw') {
      if (drawingRef.current) strokesRef.current.push(drawingRef.current)
      drawingRef.current = null
      redrawStrokes()
    } else if (mode === 'crop') {
      cropStartRef.current = null
      if (crop && (crop.w < 0.03 || crop.h < 0.03)) setCrop(null)
    }
  }

  // ---------- применение ----------
  const apply = async () => {
    setBusy(true)
    try {
      const img = imgRef.current
      const iw = img.naturalWidth, ih = img.naturalHeight
      const swap = rotation % 180 !== 0
      const k = Math.min(MAX_OUT / (swap ? ih : iw), MAX_OUT / (swap ? iw : ih), 1)
      const W = Math.round((swap ? ih : iw) * k)
      const H = Math.round((swap ? iw : ih) * k)

      const tmp = document.createElement('canvas')
      tmp.width = W
      tmp.height = H
      const ctx = tmp.getContext('2d')
      ctx.filter = filter
      ctx.translate(W / 2, H / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.filter = 'none'

      let sx = 0, sy = 0, sw = W, sh = H
      if (crop && crop.w > 0.02 && crop.h > 0.02) {
        sx = Math.round(crop.x * W)
        sy = Math.round(crop.y * H)
        sw = Math.round(crop.w * W)
        sh = Math.round(crop.h * H)
      }

      const out = document.createElement('canvas')
      out.width = sw
      out.height = sh
      const octx = out.getContext('2d')
      octx.drawImage(tmp, sx, sy, sw, sh, 0, 0, sw, sh)

      // рисунки поверх
      octx.lineCap = 'round'
      octx.lineJoin = 'round'
      for (const s of strokesRef.current) {
        octx.strokeStyle = s.color
        octx.lineWidth = Math.max(2, (s.size * W * out.width) / sw)
        octx.beginPath()
        s.points.forEach((pt, i) => {
          const x = ((pt.x * W - sx) / sw) * out.width
          const y = ((pt.y * H - sy) / sh) * out.height
          if (i === 0) octx.moveTo(x, y)
          else octx.lineTo(x, y)
        })
        if (s.points.length === 1) {
          octx.arc(
            ((s.points[0].x * W - sx) / sw) * out.width,
            ((s.points[0].y * H - sy) / sh) * out.height,
            octx.lineWidth / 2, 0, Math.PI * 2,
          )
          octx.fillStyle = s.color
          octx.fill()
        }
        octx.stroke()
      }

      out.toBlob((blob) => onDone(blob, 'jpg'), 'image/jpeg', 0.9)
    } catch {
      alert('Не удалось обработать фото')
      setBusy(false)
    }
  }

  const hasCrop = crop && crop.w > 0.02 && crop.h > 0.02

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <h3>Редактор фото</h3>
          <button className="icon-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div className="editor-tabs">
          <button className={mode === 'adjust' ? 'tab active' : 'tab'} onClick={() => setMode('adjust')}>Фильтры</button>
          <button className={mode === 'crop' ? 'tab active' : 'tab'} onClick={() => setMode('crop')}>Обрезка</button>
          <button className={mode === 'draw' ? 'tab active' : 'tab'} onClick={() => setMode('draw')}>Рисование</button>
        </div>

        <div className={'editor-preview' + (mode !== 'adjust' ? ' editing' : '')}>
          <div className="editor-canvas-stack">
            <canvas ref={previewRef} />
            <canvas
              ref={drawRef}
              className={mode === 'draw' ? 'draw-cursor' : mode === 'crop' ? 'crop-cursor' : ''}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {mode === 'crop' && hasCrop && (
              <div
                className="crop-rect"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        {mode === 'adjust' && (
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
        )}

        {mode === 'crop' && (
          <div className="editor-controls">
            <div className="editor-hint">Выдели мышью или пальцем область, которую хочешь оставить</div>
            <div className="editor-toggles">
              <button className="btn-ghost small" onClick={() => setCrop(null)} disabled={!crop}>Убрать выделение</button>
            </div>
          </div>
        )}

        {mode === 'draw' && (
          <div className="editor-controls">
            <div className="draw-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'color-dot' + (color === c ? ' selected' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <label>Толщина
              <input type="range" min="2" max="24" value={brush} onChange={(e) => setBrush(+e.target.value)} />
            </label>
            <div className="editor-toggles">
              <button className="btn-ghost small" onClick={undo}>Отменить штрих</button>
              <button className="btn-ghost small" onClick={clearDrawing}>Очистить</button>
            </div>
          </div>
        )}

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
