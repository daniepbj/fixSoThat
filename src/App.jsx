import FeatureHello from './components/FeatureHello';
import AppLinks from './components/AppLinks';
import TimerApp from './components/TimerApp';

export default function App() {
  return (
    <main className="page-shell">
      <FeatureHello />
      <AppLinks />
      <TimerApp />
    </main>
  );
}
