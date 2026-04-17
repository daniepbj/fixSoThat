export default function SectionMoveControls({
  label,
  canMoveTop,
  canMoveUp,
  canMoveDown,
  canMoveBottom,
  onMoveTop,
  onMoveUp,
  onMoveDown,
  onMoveBottom,
}) {
  return (
    <div
      className="section-move-controls"
      aria-label={`${label} order controls`}
    >
      <button
        type="button"
        className="section-move-btn section-move-btn--jump"
        onClick={onMoveTop}
        disabled={!canMoveTop}
        title={`Move ${label} to top`}
        aria-label={`Move ${label} to top`}
      >
        ⤒
      </button>
      <button
        type="button"
        className="section-move-btn"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title={`Move ${label} up`}
        aria-label={`Move ${label} up`}
      >
        ↑
      </button>
      <button
        type="button"
        className="section-move-btn"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title={`Move ${label} down`}
        aria-label={`Move ${label} down`}
      >
        ↓
      </button>
      <button
        type="button"
        className="section-move-btn section-move-btn--jump"
        onClick={onMoveBottom}
        disabled={!canMoveBottom}
        title={`Move ${label} to bottom`}
        aria-label={`Move ${label} to bottom`}
      >
        ⤓
      </button>
    </div>
  )
}
