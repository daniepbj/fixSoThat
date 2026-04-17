import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function SortableIdleRow({ itemId, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`idle-triage__row-wrap${isDragging ? " idle-triage__row-wrap--dragging" : ""}`}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

export default function IdleTriagePanel({
  queueTasks,
  mainTasks,
  afterWaitTasks,
  onReorderQueue,
  onReorderMain,
  onReorderAfterWait,
  onToggleWaitCompatible,
  onMarkAllCompatible,
  onClearAllCompatible,
  onAddToAfterWait,
  onRemoveFromAfterWait,
}) {
  const queueSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )
  const mainSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )
  const afterWaitSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  function handleQueueDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorderQueue(String(active.id), String(over.id))
  }

  function handleMainDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorderMain(String(active.id), String(over.id))
  }

  function handleAfterWaitDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorderAfterWait(String(active.id), String(over.id))
  }

  if (!queueTasks.length && !mainTasks.length) return null

  return (
    <section className="idle-triage" aria-label="Idle triage organizer">
      <div className="idle-triage__header">
        <h3 className="idle-triage__title">Idle triage</h3>
        <p className="idle-triage__subtitle">
          Good moment to sort what is next and what is compatible during waits.
        </p>
      </div>

      <div className="idle-triage__quick-actions">
        <button
          type="button"
          className="idle-triage__chip"
          onClick={onMarkAllCompatible}
        >
          Mark all compatible
        </button>
        <button
          type="button"
          className="idle-triage__chip"
          onClick={onClearAllCompatible}
        >
          Clear all compatible
        </button>
      </div>

      <div className="idle-triage__grid">
        <div className="idle-triage__card">
          <h4 className="idle-triage__card-title">
            Queue order (drag before/after)
          </h4>
          {queueTasks.length === 0 && (
            <p className="idle-triage__empty">No queued tasks to sort.</p>
          )}
          {queueTasks.length > 0 && (
            <DndContext
              sensors={queueSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleQueueDragEnd}
            >
              <SortableContext
                items={queueTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="idle-triage__list">
                  {queueTasks.map((task) => (
                    <SortableIdleRow key={task.id} itemId={task.id}>
                      {({ attributes, listeners }) => (
                        <div className="idle-triage__row">
                          <button
                            type="button"
                            className="idle-triage__drag"
                            title="Drag to reorder"
                            {...attributes}
                            {...listeners}
                          >
                            ⋮⋮
                          </button>
                          <span className="idle-triage__row-title">
                            {task.emoji} {task.title}
                          </span>
                        </div>
                      )}
                    </SortableIdleRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="idle-triage__card">
          <h4 className="idle-triage__card-title">
            Main order + wait compatibility
          </h4>
          {mainTasks.length === 0 && (
            <p className="idle-triage__empty">No active main tasks yet.</p>
          )}
          {mainTasks.length > 0 && (
            <DndContext
              sensors={mainSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMainDragEnd}
            >
              <SortableContext
                items={mainTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="idle-triage__list">
                  {mainTasks.map((task) => (
                    <SortableIdleRow key={task.id} itemId={task.id}>
                      {({ attributes, listeners }) => (
                        <div className="idle-triage__row idle-triage__row--main">
                          <button
                            type="button"
                            className="idle-triage__drag"
                            title="Drag to reorder"
                            {...attributes}
                            {...listeners}
                          >
                            ⋮⋮
                          </button>
                          <span className="idle-triage__row-title">
                            Fixa {task.title || "(no title)"}
                          </span>
                          <label className="idle-triage__checkbox">
                            <input
                              type="checkbox"
                              checked={Boolean(task.waitCompatible)}
                              onChange={() => onToggleWaitCompatible(task.id)}
                            />
                            compatible
                          </label>
                          <button
                            type="button"
                            className="idle-triage__pin"
                            onClick={() => onAddToAfterWait(task.id)}
                          >
                            Do after wait
                          </button>
                        </div>
                      )}
                    </SortableIdleRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="idle-triage__card idle-triage__card--after-wait">
          <h4 className="idle-triage__card-title">Do after wait (priority lane)</h4>
          {afterWaitTasks.length === 0 && (
            <p className="idle-triage__empty">
              Add tasks here and drag to set the exact after-wait order.
            </p>
          )}
          {afterWaitTasks.length > 0 && (
            <DndContext
              sensors={afterWaitSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleAfterWaitDragEnd}
            >
              <SortableContext
                items={afterWaitTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="idle-triage__list">
                  {afterWaitTasks.map((task) => (
                    <SortableIdleRow key={task.id} itemId={task.id}>
                      {({ attributes, listeners }) => (
                        <div className="idle-triage__row idle-triage__row--lane">
                          <button
                            type="button"
                            className="idle-triage__drag"
                            title="Drag to reorder"
                            {...attributes}
                            {...listeners}
                          >
                            ⋮⋮
                          </button>
                          <span className="idle-triage__row-title">
                            Fixa {task.title || "(no title)"}
                          </span>
                          <button
                            type="button"
                            className="idle-triage__remove"
                            onClick={() => onRemoveFromAfterWait(task.id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </SortableIdleRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </section>
  )
}
