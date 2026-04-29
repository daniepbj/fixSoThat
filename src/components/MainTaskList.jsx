import { useEffect, useState } from "react"
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
import { useMainTask } from "../context/MainTaskContext"
import SectionMoveControls from "./SectionMoveControls"
import { fmtLocalDateTime } from "../utils/timeUtils"
import MainTaskCard from "./MainTaskCard"

function SortableMainTaskRow({ task, isFocusedTop }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mtask-drag-wrap${isDragging ? " mtask-drag-wrap--dragging" : ""}${isOver ? " mtask-drag-wrap--target" : ""}${isFocusedTop ? " mtask-drag-wrap--focused-top" : ""}`}
      {...attributes}
      {...listeners}
    >
      <MainTaskCard task={task} />
    </div>
  )
}

function PivotDivider({ label, completed, onDone, onRemove }) {
  return (
    <div
      className={`pivot-divider${completed ? " pivot-divider--completed" : ""}`}
    >
      <span className="pivot-divider__label">──── PIVOT: {label} ────</span>
      <span className="pivot-divider__actions">
        {!completed && (
          <button
            type="button"
            className="pivot-divider__btn"
            onClick={onDone}
            title="Mark pivot done"
          >
            ✓ Done
          </button>
        )}
        <button
          type="button"
          className="pivot-divider__btn pivot-divider__btn--remove"
          onClick={onRemove}
          title="Remove pivot"
        >
          × Remove
        </button>
      </span>
    </div>
  )
}

export default function MainTaskList({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  const {
    deletedMainTasks,
    mainTasks,
    activeMainTaskId,
    reorderMainTask,
    undoDeleteMainTask,
    clearDeletedMainTasks,
    orderedTasks,
    setPivotOnTask,
    completePivotOnTask,
  } = useMainTask()
  const [filter, setFilter] = useState("active")
  const [showDeleted, setShowDeleted] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  useEffect(() => {
    if (activeMainTaskId && filter === "completed") {
      setFilter("active")
    }
  }, [activeMainTaskId, filter])

  const displayList = orderedTasks.filter((t) => {
    if (filter === "active") return t.status === "active"
    if (filter === "completed") return t.status === "completed"
    return true
  })

  const activeCount = mainTasks.filter((t) => t.status === "active").length
  const completedCount = mainTasks.filter(
    (t) => t.status === "completed",
  ).length

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderMainTask(active.id, over.id)
  }

  return (
    <section className="mtask-list-section" aria-label="Internal task list">
      <div className="mtask-list-header">
        <div className="mtask-list-heading">
          <button
            type="button"
            className="section-collapse-toggle"
            onClick={onToggleSectionCollapsed}
          >
            Task list
            <span className="section-collapse-arrow">
              {sectionCollapsed ? "▸" : "▾"}
            </span>
          </button>
        </div>
        <div className="mtask-list-header-actions">
          {!sectionCollapsed && (
            <div className="mtask-filter-row">
              <button
                type="button"
                className={`mtask-filter-btn ${filter === "active" ? "mtask-filter-btn--on" : ""}`}
                onClick={() => setFilter("active")}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                className={`mtask-filter-btn ${filter === "completed" ? "mtask-filter-btn--on" : ""}`}
                onClick={() => setFilter("completed")}
              >
                Done ({completedCount})
              </button>
              <button
                type="button"
                className={`mtask-filter-btn ${filter === "all" ? "mtask-filter-btn--on" : ""}`}
                onClick={() => setFilter("all")}
              >
                All ({mainTasks.length})
              </button>
            </div>
          )}
          {sectionControls && <SectionMoveControls {...sectionControls} />}
        </div>
      </div>

      {!sectionCollapsed && (
        <>
          {displayList.length === 0 && (
            <p className="mtask-empty-state">
              {filter === "active"
                ? "No active tasks. Load a Fixa output above to add one."
                : "Nothing here yet."}
            </p>
          )}

          <div className="mtask-list-cards">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayList.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {displayList.flatMap((task, idx) => {
                  const rows = []
                  if (task.pivot?.type === "before") {
                    rows.push(
                      <PivotDivider
                        key={`pivot-before-${task.id}`}
                        label="everything above first"
                        completed={task.pivot.completed}
                        onDone={() => completePivotOnTask(task.id)}
                        onRemove={() => setPivotOnTask(task.id, null)}
                      />,
                    )
                  }
                  rows.push(
                    <SortableMainTaskRow
                      key={task.id}
                      task={task}
                      isFocusedTop={idx === 0 && task.id === activeMainTaskId}
                    />,
                  )
                  if (task.pivot?.type === "after") {
                    rows.push(
                      <PivotDivider
                        key={`pivot-after-${task.id}`}
                        label="everything below first"
                        completed={task.pivot.completed}
                        onDone={() => completePivotOnTask(task.id)}
                        onRemove={() => setPivotOnTask(task.id, null)}
                      />,
                    )
                  }
                  return rows
                })}
              </SortableContext>
            </DndContext>
          </div>

          <div className="mtask-deleted-section">
            <div className="mtask-deleted-section__header">
              <button
                type="button"
                className="mtask-filter-btn"
                onClick={() => setShowDeleted((open) => !open)}
              >
                {showDeleted ? "▲" : "▼"} Deleted ({deletedMainTasks.length})
              </button>
              {deletedMainTasks.length > 0 && (
                <button
                  type="button"
                  className="mtask-action-btn mtask-action-btn--danger"
                  onClick={clearDeletedMainTasks}
                >
                  Clear all
                </button>
              )}
            </div>
            {showDeleted && (
              <div className="mtask-deleted-list">
                {deletedMainTasks.length === 0 && (
                  <p className="mtask-empty-state">No deleted main tasks.</p>
                )}
                {[...deletedMainTasks].reverse().map((task) => (
                  <div key={task.id} className="mtask-deleted-item">
                    <span className="mtask-deleted-item__title">
                      {task.title}
                    </span>
                    <span className="mtask-deleted-item__meta">
                      {fmtLocalDateTime(task.deletedAt)}
                    </span>
                    <button
                      type="button"
                      className="mtask-action-btn"
                      onClick={() => undoDeleteMainTask(task.id)}
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
