import { useEffect, useMemo, useRef, useState } from 'react'

const BARS = 34

export default function VoicePlayer({ url, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)

  const bars = useMemo(() => {
    let seed = 0
    for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) % 100000
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    return Array.from({ length: BARS }, (_, i) => {
      const v = 0.2 + rand() * 0.8
      // середина повыше — как у настоящей волны
      const center = 1 - Math.abs(i - BARS / 2) / (BARS / 2)
      return Math.max(0.15, v * (0.5 + center * 0.6))
    })
  }, [url])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setTime(a.currentTime)
    const onEnd = () => { setPlaying(false); setTime(0) }
    const onMeta = () => setDuration(a.duration || 0)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    a.addEventListener('loadedmetadata', onMeta)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('loadedmetadata', onMeta)
    }
  }, [url])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.playbackRate = rate; a.play(); setPlaying(true) }
  }

  const seek = (e) => {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    a.currentTime = p * duration
    setTime(a.currentTime)
  }

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className={'voice-player' + (mine ? ' voice-mine' : '')} onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button className={'voice-play' + (playing ? ' playing' : '')} onClick={toggle}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="voice-wave" onClick={seek}>
        {bars.map((h, i) => (
          <div
            key={i}
            className={'voice-bar' + (i / BARS <= (duration ? time / duration : 0) ? ' active' : '')}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      <span className="voice-time">{fmt(time)} / {fmt(duration)}</span>
      <button className="voice-rate" onClick={cycleRate} title="Скорость">{rate}×</button>
    </div>
  )
}
