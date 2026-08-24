import { useEffect, useRef, useState } from 'react'

export default function VideoEditor({ file, onCancel, onDone }) {
  const [url, setUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const onMeta = (e) => {
    const v = e.currentTarget
    let d = v.duration
    if (!isFinite(d)) {
      // хак для webm без длительности
      v.currentTime = 1e6
      v.ontimeupdate = () => {
        v.ontimeupdate = null
        d = v.duration
        v.currentTime = 0
        setDuration(d)
        setEnd(d)
      }
      return
    }
    setDuration(d)
    setEnd(d)
  }

  const playSelected = () => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = start
    v.play()
    const onTick = () => {
      if (!videoRef.current || v.currentTime >= end - 0.05 || v.ended) {
        v.pause()
        v.removeEventListener('timeupdate', onTick)
      }
    }
    v.addEventListener('timeupdate', onTick)
  }

  const apply = async () => {
    setBusy(true)
    setProgress(0)
    try {
      const v = videoRef.current
      v.pause()

      const MAXW = 1280
      const scale = Math.min(1, MAXW / (v.videoWidth || MAXW))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round((v.videoWidth || 1280) * scale)
      canvas.height = Math.round((v.videoHeight || 720) * scale)
      const ctx = canvas.getContext('2d')

      // звук
      const actx = new (window.AudioContext || window.webkitAudioContext)()
      const srcNode = actx.createMediaElementSource(v)
      const dest = actx.createMediaStreamDestination()
      srcNode.connect(dest) // пишем звук, но не выводим в колонки

      const stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

      let mime = 'video/webm;codecs=vp9,opus'
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 })
      const chunks = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }

      const done = new Promise((res) => {
        rec.onstop = res
      })

      v.currentTime = start
      await new Promise((r) => { v.onseeked = r })

      rec.start(200)
      await v.play()

      await new Promise((res) => {
        const tick = () => {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
          setProgress(Math.min(1, (v.currentTime - start) / Math.max(0.1, end - start)))
          if (v.currentTime >= end - 0.05 || v.ended) {
            v.pause()
            res()
          } else {
            requestAnimationFrame(tick)
          }
        }
        tick()
      })

      rec.stop()
      await done
      srcNode.disconnect()
      actx.close()

      onDone(new Blob(chunks, { type: 'video/webm' }), 'webm')
    } catch (err) {
      alert('Не удалось обработать видео: ' + err.message)
      setBusy(false)
    }
  }

  const selLen = Math.max(0, end - start)

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <h3>Редактор видео</h3>
          <button className="icon-btn" onClick={onCancel}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div className="editor-preview">
          {url && <video ref={videoRef} src={url} onLoadedMetadata={onMeta} playsInline controls={!busy} />}
        </div>

        <div className="editor-controls">
          <label>Начало: {start.toFixed(1)} сек
            <input
              type="range" min="0" max={Math.max(0, duration - 0.5)} step="0.1" value={start}
              disabled={busy || !duration}
              onChange={(e) => {
                const v = Math.min(+e.target.value, end - 0.5)
                setStart(v)
                if (videoRef.current) videoRef.current.currentTime = v
              }}
            />
          </label>
          <label>Конец: {end.toFixed(1)} сек
            <input
              type="range" min="0.5" max={duration || 0.5} step="0.1" value={end}
              disabled={busy || !duration}
              onChange={(e) => setEnd(Math.max(+e.target.value, start + 0.5))}
            />
          </label>
          <div className="editor-hint">
            Выбранный кусок: {selLen.toFixed(1)} сек из {duration ? duration.toFixed(1) : '...'} сек
          </div>
          <div className="editor-toggles">
            <button className="btn-ghost small" onClick={playSelected} disabled={busy || !duration}>
              Проиграть выбранный кусок
            </button>
            <button className="btn-ghost small" onClick={() => { setStart(0); setEnd(duration) }} disabled={busy || !duration}>
              Выбрать всё
            </button>
          </div>
          {busy && (
            <div className="trim-progress">
              <div className="trim-progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          {busy && <div className="editor-hint">Обрабатываю видео в реальном времени, не закрывай окно...</div>}
        </div>

        <div className="editor-actions">
          <button className="btn-ghost" onClick={onCancel}>Отмена</button>
          <button className="btn-primary" style={{ maxWidth: 180 }} onClick={apply} disabled={busy || !duration}>
            {busy ? <span className="spinner" /> : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}
