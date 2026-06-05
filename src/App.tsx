import { useApp } from './store/AppContext'
import TopBar from './components/TopBar'
import Overview from './components/Overview'
import ProjectDetail from './components/ProjectDetail'
import Backlog from './components/Backlog'
import Settings from './components/Settings'
import Modals from './components/Modals'
import Auth from './components/Auth'

export default function App() {
  const { ui, status } = useApp()

  if (status === 'loading')
    return (
      <div className="splash">
        <div className="big">LOADING…</div>
      </div>
    )
  if (status === 'auth') return <Auth />

  return (
    <div className="app">
      <TopBar />
      <div className="stage">
        {ui.mode === 'backlog' ? (
          <Backlog />
        ) : ui.mode === 'settings' ? (
          <Settings />
        ) : ui.mode === 'project' ? (
          <ProjectDetail />
        ) : (
          <Overview />
        )}
      </div>
      <Modals />
    </div>
  )
}
