const NAV_ITEMS = [
  { id: 'timer',    label: 'Timer',    icon: '⏱' },
  { id: 'not-now',  label: 'Not-Now',  icon: '⏭' },
  { id: 'report',   label: 'Report',   icon: '📊' },
  { id: 'presets',  label: 'Presets',  icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav({ currentView, setCurrentView }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`bottom-nav__btn ${currentView === item.id ? 'active' : ''}`}
          onClick={() => setCurrentView(item.id)}
          aria-current={currentView === item.id ? 'page' : undefined}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
