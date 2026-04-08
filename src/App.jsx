import FeatureHello from "./components/FeatureHello"
import AppLinks from "./components/AppLinks"
import TimerApp from "./components/TimerApp"
import StructuredTaskBuilder from "./components/StructuredTaskBuilder"

export default function App() {
  return (
    <main className="page-shell">
      <FeatureHello />
      <AppLinks />
      <StructuredTaskBuilder />
      <TimerApp />
    </main>
  )
}
