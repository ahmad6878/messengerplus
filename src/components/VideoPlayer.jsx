import { useRef, useState } from 'react'

export default function VideoPlayer({ url, large }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
  }

  const seek = (e) => {
    const v = ref.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    v.currentTime = p * duration
    setTime(v.currentTime)
  }

  const toggleMute = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const pct = duration ? (time / duration) * 100 : 0

  return (
    <div className={'video-player' + (large ? ' video-large' : '')}>
      <div className="video-frame" onClick={toggle}>
        <video
          ref={ref}
          src={url}
          preload="metadata"
          playsInline
          muted={muted}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (isFinite(v.duration)) { setDuration(v.duration); return }
            // webm от MediaRecorder часто без длительности — вычисляем
            v.currentTime = 1e6
            v.ontimeupdate = () => {
              v.ontimeupdate = null
              setDuration(v.duration)
              v.currentTime = 0
            }
          }}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <div className="video-bigplay">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        )}
      </div>
      <div className="video-controls">
        <button className="video-ctrl-btn" onClick={toggle} title={playing ? 'Пауза' : 'Играть'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <div className="video-seek" onClick={seek}>
          <div className="video-seek-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="voice-time">{fmt(time)} / {fmt(duration)}</span>
        <button className="video-ctrl-btn" onClick={toggleMute} title="Звук">
          {muted ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          )}
        </button>
      </div>
    </div>
  )
}
