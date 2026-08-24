import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import VoicePlayer from './VoicePlayer.jsx'
import PhotoEditor from './PhotoEditor.jsx'
import Lightbox from './Lightbox.jsx'

export default function ChatWindow({ myId, peer, bg, onCall }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [sending, setSending] = useState(false)
  const [editPhoto, setEditPhoto] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const listRef = useRef(null)
  const fileRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${peer.id}),and(sender_id.eq.${peer.id},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(500)
    setMessages(data || [])
    scrollDown()
  }

  useEffect(() => { loadMessages() }, [peer.id])

  useEffect(() => {
    const ch = supabase
      .channel(`chat:${[myId, peer.id].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (
          (m.sender_id === myId && m.receiver_id === peer.id) ||
          (m.sender_id === peer.id && m.receiver_id === myId)
        ) {
          setMessages((prev) => [...prev, m])
          scrollDown()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, peer.id])

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  const send = async (fields) => {
    setSending(true)
    try {
      await supabase.from('messages').insert({
        sender_id: myId,
        receiver_id: peer.id,
        ...fields,
      })
    } finally {
      setSending(false)
    }
  }

  const sendText = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    await send({ type: 'text', content: t })
  }

  const uploadFile = async (blob, ext) => {
    const name = `${myId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(name, blob, { upsert: true })
    if (error) { alert('Ошибка загрузки: ' + error.message); return null }
    const { data } = supabase.storage.from('media').getPublicUrl(name)
    return data.publicUrl
  }

  const sendPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('Максимальный размер — 20 МБ'); return }
    setEditPhoto(file)
  }

  const onPhotoEdited = async (blob, ext) => {
    setEditPhoto(null)
    const url = await uploadFile(blob, ext)
    if (url) await send({ type: 'image', file_url: url })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => chunksRef.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 1000) {
          const url = await uploadFile(blob, 'webm')
          if (url) await send({ type: 'audio', file_url: url, content: String(recSeconds) })
        }
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch {
      alert('Нет доступа к микрофону')
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    setRecording(false)
    recorderRef.current?.stop()
  }

  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  return (
    <main className="chat">
      <header className="chat-header">
        <div className="avatar">{(peer.display_name || peer.username)[0].toUpperCase()}</div>
        <div>
          <div className="chat-header-name">{peer.display_name || peer.username}</div>
          <div className="chat-header-username">@{peer.username}</div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" title="Аудиозвонок" onClick={() => onCall(peer, false)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
          </button>
          <button className="icon-btn" title="Видеозвонок" onClick={() => onCall(peer, true)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          </button>
        </div>
      </header>

      <div className={`messages bg-${bg}`} ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">Сообщений пока нет — напишите первым!</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={'bubble-row ' + (m.sender_id === myId ? 'mine' : 'theirs')}>
            <div className={'bubble ' + (m.sender_id === myId ? 'bubble-mine' : 'bubble-theirs')}>
              {m.type === 'text' && <div className="bubble-text">{m.content}</div>}
              {m.type === 'image' && (
                <img
                  src={m.file_url}
                  alt="фото"
                  className="bubble-img clickable"
                  loading="lazy"
                  onClick={() => setLightbox(m.file_url)}
                />
              )}
              {m.type === 'audio' && <VoicePlayer url={m.file_url} mine={m.sender_id === myId} />}
              <div className="bubble-time">{fmtTime(m.created_at)}</div>
            </div>
          </div>
        ))}
      </div>

      <footer className="composer">
        {recording ? (
          <div className="recording-bar">
            <span className="rec-dot" />
            <span>Запись... {recSeconds} сек</span>
            <button className="btn-primary small" onClick={stopRecording}>Отправить</button>
            <button className="btn-ghost small" onClick={() => { chunksRef.current = []; clearInterval(timerRef.current); setRecording(false); recorderRef.current?.stop() }}>
              Отмена
            </button>
          </div>
        ) : (
          <>
            <button className="icon-btn" title="Отправить фото" onClick={() => fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendPhoto} />
            <form className="composer-form" onSubmit={sendText}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Напишите сообщение..."
              />
            </form>
            <button className="icon-btn" title="Голосовое сообщение" onClick={startRecording}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
            </button>
            <button className="send-btn" title="Отправить" onClick={sendText} disabled={sending}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </>
        )}
      </footer>

      {editPhoto && (
        <PhotoEditor
          file={editPhoto}
          onCancel={() => setEditPhoto(null)}
          onDone={onPhotoEdited}
        />
      )}

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </main>
  )
}
