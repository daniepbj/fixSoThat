import SectionMoveControls from "./SectionMoveControls"

const text = "Hello world"

export default function FeatureHello({ sectionControls }) {
  return (
    <section className="hero-card" aria-label="hello world feature">
      <div className="hero-card__header">
        <p className="hero-kicker">Feature component</p>
        {sectionControls && <SectionMoveControls {...sectionControls} />}
      </div>
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
    </section>
  )
}
