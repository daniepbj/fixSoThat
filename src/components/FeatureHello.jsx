import SectionMoveControls from "./SectionMoveControls"

const text = "Hello world"

export default function FeatureHello({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  return (
    <section className="hero-card" aria-label="hello world feature">
      <div className="hero-card__header">
        <button
          type="button"
          className="section-collapse-toggle"
          onClick={onToggleSectionCollapsed}
        >
          Feature component
          <span className="section-collapse-arrow">
            {sectionCollapsed ? "▸" : "▾"}
          </span>
        </button>
        {sectionControls && <SectionMoveControls {...sectionControls} />}
      </div>
      {!sectionCollapsed && (
        <h1 className="hero-title" role="heading" aria-level="1">
          {text.split("").map((char, index) => (
            <span
              key={`${char}-${index}`}
              className="hero-char"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </h1>
      )}
    </section>
  )
}
