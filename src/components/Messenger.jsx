import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import ChatWindow from './ChatWindow.jsx'
import CallOverlay from './CallOverlay.jsx'
import CallManager from '../lib/call.js'

export default function Messenger({ session, profile }) {
  const myId = session.user.id
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [chats, setChats] = useState([]) // [{profile, lastMessage, lastAt}]
  const [active, setActive] = useState(null) // профиль собеседника
  const [call, setCall] = useState(null) // {peer, video, state}
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  const callRef = useRef(null)
  const activeCallRef = useRef(null) // {peerId, video}
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  // ---------- список чатов ----------
  const loadChats = async () => {
    const { data } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, content, type, created_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(300)
    if (!data) return
    const map = new Map()
    for (const m of data) {
      const peer = m.sender_id === myId ? m.receiver_id : m.sender_id
      if (!map.has(peer)) map.set(peer, m)
    }
    if (map.size === 0) { setChats([]); return }
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', [...map.keys()])
    const list = (profiles || []).map((p) => ({
      profile: p,
      last: map.get(p.id),
    }))
    list.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1))
    setChats(list)
  }

  useEffect(() => { loadChats() }, [myId])

  // ---------- realtime: обновление списка чатов ----------
  useEffect(() => {
    const ch = supabase
      .channel('messages-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (m.sender_id === myId || m.receiver_id === myId) loadChats()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId])

  // ---------- поиск пользователей ----------
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `${q}%`)
        .neq('id', myId)
        .limit(20)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [search, myId])

  // ---------- звонки ----------
  useEffect(() => {
    const cm = new CallManager(supabase, myId)
    callRef.current = cm
    cm.listen()
    cm.onEvent = async (msg) => {
      if (msg.kind === 'offer') {
        // входящий звонок (или второй offer — игнорируем если уже звоним)
        if (activeCallRef.current) {
          cm.send(msg.from, { kind: 'busy' })
          return
        }
        const { data: p } = await supabase.from('profiles').select('*').eq('id', msg.from).single()
        activeCallRef.current = { peerId: msg.from, video: msg.video }
        cm.peerId = msg.from
        setCall({ peer: p, video: msg.video, state: 'ringing' })
        cm.pendingOffer = msg.data
      } else if (msg.kind === 'answer') {
        cm.handleSignal(msg)
        setCall((c) => c && { ...c, state: 'connecting' })
      } else if (msg.kind === 'ice') {
        cm.handleSignal(msg)
      } else if (msg.kind === 'accept') {
        setCall((c) => c && { ...c, state: 'connecting' })
      } else if (msg.kind === 'reject' || msg.kind === 'busy') {
        endCall()
        if (msg.kind === 'busy') alert('Пользователь занят')
      } else if (msg.kind === 'hangup') {
        endCall()
      } else if (msg.kind === 'state') {
        if (msg.data === 'connected') setCall((c) => c && { ...c, state: 'connected' })
        if (msg.data === 'failed') setCall((c) => c && { ...c, state: 'failed' })
      } else if (msg.kind === 'remote-stream') {
        if (remoteVideoRef.current && cm.remoteStream) {
          remoteVideoRef.current.srcObject = cm.remoteStream
        }
      }
    }
    return () => cm.destroy()
  }, [myId])

  const startCall = async (peerProfile, video) => {
    if (activeCallRef.current) return
    activeCallRef.current = { peerId: peerProfile.id, video }
    setCall({ peer: peerProfile, video, state: 'outgoing' })
    try {
      await callRef.current.start(peerProfile.id, video)
    } catch (e) {
      alert('Не удалось получить доступ к ' + (video ? 'камере/микрофону' : 'микрофону'))
      endCall()
    }
  }

  const acceptCall = async () => {
    const c = call
    if (!c) return
    try {
      await callRef.current.accept(callRef.current.pendingOffer, c.video)
      setCall({ ...c, state: 'connecting' })
      attachLocalVideo()
    } catch (e) {
      alert('Не удалось получить доступ к камере/микрофону')
      declineCall()
    }
  }

  const attachLocalVideo = () => {
    requestAnimationFrame(() => {
      if (localVideoRef.current && callRef.current.localStream) {
        localVideoRef.current.srcObject = callRef.current.localStream
      }
    })
  }

  const declineCall = () => {
    const a = activeCallRef.current
    if (a) callRef.current.send(a.peerId, { kind: 'reject' })
    callRef.current.hangup()
    activeCallRef.current = null
    setCall(null)
  }

  const endCall = () => {
    const a = activeCallRef.current
    if (a) callRef.current.send(a.peerId, { kind: 'hangup' })
    callRef.current.hangup()
    activeCallRef.current = null
    setCall(null)
  }

  useEffect(() => {
    if (call && (call.state === 'outgoing' || call.state === 'connecting' || call.state === 'connected')) {
      attachLocalVideo()
    }
  }, [call])

  const toggleMute = () => {
    const s = callRef.current.localStream
    if (s) {
      const next = !muted
      s.getAudioTracks().forEach((t) => (t.enabled = !next))
      setMuted(next)
    }
  }

  const toggleCam = () => {
    const s = callRef.current.localStream
    if (s) {
      const next = !camOff
      s.getVideoTracks().forEach((t) => (t.enabled = !next))
      setCamOff(next)
    }
  }

  const openChat = (p) => {
    setActive(p)
    setSearch('')
    if (!chats.some((c) => c.profile.id === p.id)) {
      setChats((prev) => [{ profile: p, last: null }, ...prev])
    }
  }

  const sidebarChats = useMemo(() => {
    if (!search.trim()) return chats
    return []
  }, [search, chats])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="me">
          <div className="avatar">{(profile.display_name || profile.username)[0].toUpperCase()}</div>
          <div className="me-info">
            <div className="me-name">{profile.display_name || profile.username}</div>
            <div className="me-username">@{profile.username}</div>
          </div>
          <button className="icon-btn" title="Выйти" onClick={() => supabase.auth.signOut()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>

        <div className="search-box">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по @username..."
          />
        </div>

        <div className="chat-list">
          {search.trim() ? (
            results.length === 0 ? (
              <div className="empty">Никого не найдено</div>
            ) : (
              results.map((p) => (
                <div key={p.id} className="chat-item" onClick={() => openChat(p)}>
                  <div className="avatar">{(p.display_name || p.username)[0].toUpperCase()}</div>
                  <div className="chat-item-info">
                    <div className="chat-item-name">{p.display_name || p.username}</div>
                    <div className="chat-item-last">@{p.username}</div>
                  </div>
                </div>
              ))
            )
          ) : chats.length === 0 ? (
            <div className="empty">Найдите кого-нибудь через поиск ↑</div>
          ) : (
            sidebarChats.map((c) => (
              <div
                key={c.profile.id}
                className={'chat-item' + (active && active.id === c.profile.id ? ' selected' : '')}
                onClick={() => openChat(c.profile)}
              >
                <div className="avatar">{(c.profile.display_name || c.profile.username)[0].toUpperCase()}</div>
                <div className="chat-item-info">
                  <div className="chat-item-name">{c.profile.display_name || c.profile.username}</div>
                  <div className="chat-item-last">
                    {c.last
                      ? c.last.type === 'text' ? c.last.content
                        : c.last.type === 'image' ? '📷 Фото'
                        : '🎤 Голосовое сообщение'
                      : 'Начните переписку'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {active ? (
        <ChatWindow
          key={active.id}
          myId={myId}
          me={profile}
          peer={active}
          onCall={startCall}
        />
      ) : (
        <div className="screen-center chat-placeholder">
          <div className="logo-badge big">
            <svg viewBox="0 0 24 24" width="42" height="42" fill="none">
              <path d="M12 3C7 3 3 6.6 3 11c0 2.5 1.3 4.7 3.4 6.2-.2 1.2-.8 2.5-2 3.5 2.2-.2 4-.9 5.3-1.8 1.1.3 2.2.5 3.3.5 5 0 9-3.6 9-8.4S17 3 12 3z" fill="currentColor"/>
            </svg>
          </div>
          <h2>Выберите чат</h2>
          <p>Найдите пользователя по username и начните общение</p>
        </div>
      )}

      {call && (
        <CallOverlay
          call={call}
          peer={call.peer}
          onAccept={acceptCall}
          onReject={declineCall}
          onHangup={endCall}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          muted={muted}
          toggleMute={toggleMute}
          camOff={camOff}
          toggleCam={toggleCam}
        />
      )}
    </div>
  )
}
