import { useEffect, useRef, useState } from 'react'

export default function CallOverlay({ call, profile, peer, onAccept, onReject, onHangup, localVideoRef, remoteVideoRef, remoteAudioRef, muted, toggleMute, camOff, toggleCam, sharing, toggleScreen, canShare, localHasVideo }) {
  const [seconds, setSeconds] = useState(0)
  const startedRef = useRef(false)
  const audioCtxRef = useRef(null)
  const ringTimerRef = useRef(null)

  // ---------- мелодия звонка ----------
  useEffect(() => {
    const ringing = call.state === 'ringing' || call.state === 'outgoing'
    if (!ringing) {
      clearInterval(ringTimerRef.current)
      return
    }
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    ctx.resume()
    const incoming = call.state === 'ringing'

    const beep = (freq, at, dur, vol = 0.07) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(vol, at + 0.04)
      g.gain.setValueAtTime(vol, at + dur - 0.04)
      g.gain.linearRampToValueAtTime(0, at + dur)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(at)
      o.stop(at + dur)
    }

    const cycle = () => {
      const t = ctx.currentTime
      if (incoming) {
        beep(440, t, 0.4)
        beep(440, t + 0.6, 0.4)
      } else {
        beep(440, t, 0.7)
      }
    }

    cycle()
    ringTimerRef.current = setInterval(cycle, incoming ? 2000 : 3000)
    return () => clearInterval(ringTimerRef.current)
  }, [call.state])

  // остановка звука при размонтировании
  useEffect(() => () => {
    clearInterval(ringTimerRef.current)
    audioCtxRef.current?.close()
  }, [])

  useEffect(() => {
    if (call.state === 'connected' && !startedRef.current) {
      startedRef.current = true
      const t = setInterval(() => setSeconds((s) => s + 1), 1000)
      return () => clearInterval(t)
    }
    if (call.state !== 'connected') { startedRef.current = false; setSeconds(0) }
  }, [call.state])

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  const stateText = {
    ringing: 'Входящий звонок...',
    outgoing: 'Вызов...',
    connecting: 'Соединение...',
    connected: time,
    failed: 'Не удалось соединиться',
  }[call.state] || ''

  return (
    <div className="call-overlay">
      {call.video && call.state !== 'ringing' ? (
        <div className="call-video-wrap">
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
          {localHasVideo && (
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          )}
        </div>
      ) : (
        <div className="call-avatar-wrap">
          <audio ref={remoteAudioRef} autoPlay />
          <div className="call-avatar">{(peer.display_name || peer.username || '?')[0].toUpperCase()}</div>
          <div className="call-pulse" />
        </div>
      )}

      <div className="call-info">
        <div className="call-name">{peer.display_name || peer.username}</div>
        <div className="call-state">{stateText}</div>
      </div>

      <div className={'call-controls' + (sharing ? ' compact' : '')}>
        {call.state === 'ringing' ? (
          <>
            <button className="call-btn danger" title="Отклонить" onClick={onReject}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .4-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
            </button>
            <button className="call-btn success" title="Принять" onClick={onAccept}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
          </>
        ) : (
          <>
            {call.state !== 'failed' && (
              <button className={'call-btn ' + (muted ? 'warn' : 'ghost')} title="Микрофон" onClick={toggleMute}>
                {muted ? (
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M19 11c0 1.19-.22 2.33-.62 3.38l-1.57-1.57c.13-.58.19-1.19.19-1.81h2zM5.27 3.5L3.5 5.27l2.63 2.63C5.4 9.06 5 10.5 5 11H3c0-1.57.35-3.06 1.02-4.39L5.27 3.5zM21 5l-1.5-1.5L3.51 19.49 5 21l4.24-4.24c.83.43 1.74.72 2.71.85V21h-3v2h8v-2h-3v-3.39c3.4-.49 6-3.39 6-6.61h-2c0 3.31-2.69 6-6 6-.68 0-1.33-.11-1.94-.32l1.72-1.72c.07.01.14.04.22.04 1.66 0 3-1.34 3-3v-1.18L21 5zM8.71 8.71l3.29 3.29V12c0-1.66-1.34-3-3-3-.1 0-.19.03-.29.04V8.71z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
                )}
              </button>
            )}
            {call.state !== 'failed' && (
              <button className={'call-btn ' + (camOff ? 'warn' : 'ghost')} title="Камера" onClick={toggleCam}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
              </button>
            )}
            {canShare && call.state !== 'failed' && (
              <button
                className={'call-btn ' + (sharing ? 'warn' : 'ghost')}
                title={sharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
                onClick={toggleScreen}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-8-2h-2v-3H8l4-4 4 4h-3z"/></svg>
              </button>
            )}
            <button className="call-btn danger" title="Завершить" onClick={onHangup}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .4-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
