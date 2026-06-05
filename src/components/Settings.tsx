import { useApp } from '../store/AppContext'

export default function Settings() {
  const { theme, setTheme, data } = useApp()

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flowdeck-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="settings">
      <h2>Settings</h2>
      <p className="lead">Preferences are stored on this device.</p>

      <div className="set-row" style={{ borderTop: 0 }}>
        <div className="info">
          <b>Appearance</b>
          <p>Switch between dark and light themes.</p>
        </div>
        <div className="seg-toggle">
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
        </div>
      </div>

      <div className="set-row">
        <div className="info">
          <b>Export backup</b>
          <p>Download all your projects, tasks, maps, and backlog as a JSON file.</p>
        </div>
        <button className="btn" onClick={exportAll}>Download JSON</button>
      </div>

      <div className="set-row">
        <div className="info">
          <b>About</b>
          <p>Flowdeck · workflow tracker. Board, feature map, and personal backlog.</p>
        </div>
        <span className="clock">v0.1.0</span>
      </div>
    </div>
  )
}
