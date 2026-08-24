import VideoPlayer from './VideoPlayer.jsx'

export default function Lightbox({ url, video, onClose }) {
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <a className="icon-btn" href={url} target="_blank" rel="noreferrer" title="Открыть оригинал" download>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </a>
        <button className="icon-btn" onClick={onClose} title="Закрыть">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      {video ? (
        <div onClick={(e) => e.stopPropagation()}>
          <VideoPlayer url={url} large />
        </div>
      ) : (
        <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  )
}
