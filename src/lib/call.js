const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]

export default class CallManager {
  constructor(supabase, myId) {
    this.sb = supabase
    this.myId = myId
    this.pc = null
    this.localStream = null
    this.remoteStream = null
    this.peerId = null
    this.pendingIce = []
    this.onEvent = () => {}
  }

  // channel = личный "почтовый ящик" пользователя для сигналинга
  listen() {
    this.channel = this.sb.channel(`user:${this.myId}`)
    this.channel.on('broadcast', { event: 'call' }, ({ payload }) => {
      this.onEvent(payload)
    }).subscribe()
  }

  async send(peerId, payload) {
    const ch = this.sb.channel(`user:${peerId}`)
    await ch.subscribe()
    await ch.send({ type: 'broadcast', event: 'call', payload: { ...payload, from: this.myId } })
    this.sb.removeChannel(ch)
  }

  async createPeer(video) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.remoteStream = new MediaStream()

    this.pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => this.remoteStream.addTrack(t))
      this.onEvent({ kind: 'remote-stream' })
    }
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send(this.peerId, { kind: 'ice', data: e.candidate.toJSON() })
    }
    this.pc.onconnectionstatechange = () => {
      this.onEvent({ kind: 'state', data: this.pc?.connectionState })
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    } catch {
      // нет камеры — пробуем только микрофон
      if (video) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } else throw new Error('Нет доступа к микрофону')
    }
    this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream))
    // видео-отправитель есть всегда — тогда замену трека (демонстрация экрана)
    // можно делать без пересогласования соединения
    if (video) {
      this.videoSender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video')
    } else {
      this.videoSender = this.pc.addTransceiver('video', { direction: 'sendrecv' }).sender
    }
    return this.localStream
  }

  async flushIce() {
    const list = this.pendingIce
    this.pendingIce = []
    for (const c of list) {
      try { await this.pc.addIceCandidate(c) } catch { /* гонки ICE не критичны */ }
    }
  }

  async start(peerId, video) {
    this.peerId = peerId
    await this.createPeer(video)
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    await this.flushIce()
    await this.send(peerId, { kind: 'offer', data: offer, video })
  }

  async accept(offer, video) {
    await this.createPeer(video)
    await this.pc.setRemoteDescription(offer)
    await this.flushIce()
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    await this.send(this.peerId, { kind: 'answer', data: answer })
  }

  async handleSignal(msg) {
    try {
      if (msg.kind === 'answer' && this.pc) {
        await this.pc.setRemoteDescription(msg.data)
      } else if (msg.kind === 'ice' && msg.data) {
        if (!this.pc) {
          // pc ещё не создан — буферизуем, чтобы кандидаты не потерялись
          this.pendingIce.push(msg.data)
        } else {
          await this.pc.addIceCandidate(msg.data)
        }
      }
    } catch { /* игнорируем гонки ICE */ }
  }

  hangup() {
    try { this.pc && this.pc.close() } catch {}
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.pc = null
    this.localStream = null
    this.remoteStream = null
    this.peerId = null
    this.videoSender = null
    this.pendingIce = []
  }

  destroy() {
    this.hangup()
    this.channel && this.sb.removeChannel(this.channel)
  }
}
