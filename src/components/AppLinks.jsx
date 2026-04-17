import SectionMoveControls from "./SectionMoveControls"

const apps = [
  { name: "LLama tasks", url: "https://llamalife.co/tasks" },
  { name: "Ticktick Pomodoro", url: "https://ticktick.com/webapp#focus" },
  { name: "MSTodo", url: "https://to-do.live.com/tasks/today" },
  {
    name: "TickTick calendar",
    url: "https://ticktick.com/webapp#c/all/calendar/d",
  },
]

export default function AppLinks({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  return (
    <section className="app-links-card" aria-label="Apps I use">
      <div className="app-links-header">
        <button
          type="button"
          className="section-collapse-toggle"
          onClick={onToggleSectionCollapsed}
        >
          Apps I use
          <span className="section-collapse-arrow">
            {sectionCollapsed ? "▸" : "▾"}
          </span>
        </button>
        {sectionControls && <SectionMoveControls {...sectionControls} />}
      </div>
      {!sectionCollapsed && (
        <ul className="app-links-list">
          {apps.map(({ name, url }) => (
            <li key={name}>
              <a
                href={url}
                className="app-link"
                target="_blank"
                rel="noreferrer noopener"
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
