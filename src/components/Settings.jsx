import { useState } from 'react'
import { supabase } from '../supabaseClient'

export const BACKGROUNDS = [
  { id: 'default', name: 'Стандарт', css: 'linear-gradient(135deg, #1a2032, #12172a)' },
  { id: 'aurora', name: 'Аврора', css: 'linear-gradient(135deg, #2e1065, #1e3a8a, #0f766e)' },
  { id: 'sunset', name: 'Закат', css: 'linear-gradient(135deg, #7c2d12, #9d174d, #4c1d95)' },
  { id: 'ocean', name: 'Океан', css: 'linear-gradient(135deg, #082f49, #0c4a6e, #164e63)' },
  { id: 'forest', name: 'Лес', css: 'linear-gradient(135deg, #14532d, #065f46, #1a2e05)' },
  { id: 'plain', name: 'Однотонный', css: 'var(--bg)' },
]

export default function Settings({ profile, onClose, onProfileUpdate, theme, setTheme, bg, setBg }) {
  const [name, setName] = useState(profile.display_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveName = async () => {
    const n = name.trim()
    if (!n) return
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: n })
      .eq('id', profile.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onProfileUpdate(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <h3>Настройки</h3>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div className="settings-body">
          <section>
            <h4>Аккаунт</h4>
            <div className="settings-row">
              <div className="avatar">{(profile.display_name || profile.username)[0].toUpperCase()}</div>
              <div className="settings-account">
                <div className="settings-username">@{profile.username}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Имя"
                  maxLength={30}
                />
              </div>
              <button className="btn-primary small" onClick={saveName} disabled={saving || !name.trim()}>
                {saving ? <span className="spinner" /> : saved ? '✓' : 'Сохранить'}
              </button>
            </div>
          </section>

          <section>
            <h4>Тема</h4>
            <div className="theme-options">
              <button
                className={'theme-card' + (theme === 'dark' ? ' selected' : '')}
                onClick={() => setTheme('dark')}
              >
                <div className="theme-preview dark-prev">
                  <span /><span /><span />
                </div>
                Тёмная
              </button>
              <button
                className={'theme-card' + (theme === 'light' ? ' selected' : '')}
                onClick={() => setTheme('light')}
              >
                <div className="theme-preview light-prev">
                  <span /><span /><span />
                </div>
                Светлая
              </button>
            </div>
          </section>

          <section>
            <h4>Фон чата</h4>
            <div className="bg-options">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  className={'bg-card' + (bg === b.id ? ' selected' : '')}
                  style={{ background: b.css }}
                  onClick={() => setBg(b.id)}
                  title={b.name}
                >
                  {bg === b.id && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
