const apps = [
  { name: "LLama tasks", url: "https://llamalife.co/tasks" },
  { name: "Ticktick Pomodoro", url: "https://ticktick.com/webapp#focus" },
  { name: "MSTodo", url: "https://to-do.live.com/tasks/today" },
  {
    name: "TickTick calendar",
    url: "https://ticktick.com/webapp#c/all/calendar/d",
  },
]

export default function AppLinks() {
  return (
    <section className="app-links-card" aria-label="Apps I use">
      <p className="hero-kicker">Apps I use</p>
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
    </section>
  )
}
