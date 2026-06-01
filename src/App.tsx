import { useApp } from './store/AppContext'
import TopBar from './components/TopBar'
import Overview from './components/Overview'
import ProjectDetail from './components/ProjectDetail'
import Backlog from './components/Backlog'
import Modals from './components/Modals'

export default function App() {
  const { ui } = useApp()
  return (
    <div className="app">
      <TopBar />
      <div className="stage">
        {ui.mode === 'backlog' ? <Backlog /> : ui.mode === 'project' ? <ProjectDetail /> : <Overview />}
      </div>
      <Modals />
    </div>
  )
}
