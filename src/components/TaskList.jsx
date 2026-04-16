import { useState } from "react"
import { fmtLocalDateTime, fmtLocalTime } from "../utils/timeUtils"
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
import TaskCard from "./TaskCard"

function SortableTaskRow({
  task,
  idx,
  totalTasks,
  completeTask,
  deleteTask,
  resetTask,
  deferTask,
  moveUp,
  moveDown,
  moveToTop,
  moveToBottom,
  playTask,
  toggleTaskFlag,
}) {
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
      className={`task-drag-wrap${isDragging ? " task-drag-wrap--dragging" : ""}${isOver ? " task-drag-wrap--target" : ""}`}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        isFirst={idx === 0}
        index={idx}
        totalTasks={totalTasks}
        completeTask={completeTask}
        deleteTask={deleteTask}
        resetTask={resetTask}
        deferTask={deferTask}
        moveUp={moveUp}
        moveDown={moveDown}
        moveToTop={moveToTop}
        moveToBottom={moveToBottom}
        playTask={playTask}
        toggleTaskFlag={toggleTaskFlag}
      />
    </div>
  )
}

export default function TaskList({
  activeTasks,
  completedTasks,
  deletedTasks,
  settings,
  completeTask,
  restoreCompletedTask,
  deleteTask,
  undoDeleteTask,
  clearDeletedTasks,
  resetTask,
  deferTask,
  moveUp,
  moveDown,
  moveToTop,
  moveToBottom,
  reorderTask,
  playTask,
  toggleTaskFlag,
  emojiMe,
  colorMe,
  randomTask,
  addOvertime,
  clearActiveTasks,
  showAddForm,
  setShowAddForm,
}) {
  const [showCompleted, setShowCompleted] = useState(
    settings.showCompletedByDefault,
  )
  const [showDeleted, setShowDeleted] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderTask(active.id, over.id)
  }

  return (
    <section className="task-list-section">
      {/* Quick action buttons */}
      <div className="quick-actions">
        <button
          className="quick-btn"
          onClick={emojiMe}
          title="Assign random emoji to current task"
        >
          🎲 Emoji Me!
        </button>
        <button
          className="quick-btn"
          onClick={colorMe}
          title="Assign random color to current task"
        >
          🎨 Color Me!
        </button>
        <button
          className="quick-btn"
          onClick={randomTask}
          title="Pick a random task as current"
        >
          🔀 Random
        </button>
        <button
          className="quick-btn"
          onClick={() => addOvertime(5)}
          title="Add 5 minutes to current task"
        >
          ⏱ +Overtime
        </button>
        <button
          className="quick-btn quick-btn--danger"
          onClick={clearActiveTasks}
          title="Clear all active tasks"
        >
          🗑 Clear
        </button>
      </div>

      {/* Active task list */}
      <div className="task-list">
        {activeTasks.length === 0 && (
          <p className="list-empty">No active tasks — add one below!</p>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {activeTasks.map((task, idx) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                idx={idx}
                totalTasks={activeTasks.length}
                completeTask={completeTask}
                deleteTask={deleteTask}
                resetTask={resetTask}
                deferTask={deferTask}
                moveUp={moveUp}
                moveDown={moveDown}
                moveToTop={moveToTop}
                moveToBottom={moveToBottom}
                playTask={playTask}
                toggleTaskFlag={toggleTaskFlag}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button className="add-task-btn" onClick={() => setShowAddForm(true)}>
        + Add Task
      </button>

      {/* Completed tasks collapsible */}
      <div className="completed-section">
        <button
          className="toggle-btn"
          onClick={() => setShowCompleted((s) => !s)}
        >
          {showCompleted ? "▲" : "▼"} Completed ({completedTasks.length})
        </button>
        {showCompleted && (
          <div className="completed-list">
            {completedTasks.length === 0 && (
              <p className="list-empty">No completed tasks yet.</p>
            )}
            {[...completedTasks].reverse().map((task) => (
              <div key={task.id} className="completed-task">
                <span>{task.emoji}</span>
                <span className="completed-task__title">{task.title}</span>
                <span className="completed-task__meta">
                  {task.estimatedMinutes}m est ·{" "}
                  {Math.round(task.spentSeconds / 60)}m spent
                </span>
                <span className="completed-task__time">
                  {fmtLocalTime(task.completedAt)}
                </span>
                <button
                  type="button"
                  className="completed-task__restore"
                  onClick={() => restoreCompletedTask(task.id)}
                  title="Move back to active"
                  aria-label={`Restore ${task.title}`}
                >
                  ↺
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="deleted-section">
        <div className="deleted-section__header">
          <button
            className="toggle-btn"
            onClick={() => setShowDeleted((s) => !s)}
          >
            {showDeleted ? "▲" : "▼"} Deleted ({deletedTasks.length})
          </button>
          {deletedTasks.length > 0 && (
            <button
              type="button"
              className="deleted-task__clear"
              onClick={clearDeletedTasks}
            >
              Clear all
            </button>
          )}
        </div>
        {showDeleted && (
          <div className="deleted-list">
            {deletedTasks.length === 0 && (
              <p className="list-empty">No deleted tasks.</p>
            )}
            {[...deletedTasks].reverse().map((task) => (
              <div key={task.id} className="deleted-task">
                <span>{task.emoji}</span>
                <span className="deleted-task__title">{task.title}</span>
                <span className="deleted-task__meta">
                  {task.estimatedMinutes}m est
                </span>
                <span className="deleted-task__time">
                  {fmtLocalDateTime(task.deletedAt)}
                </span>
                <button
                  type="button"
                  className="deleted-task__undo"
                  onClick={() => undoDeleteTask(task.id)}
                  title="Restore task"
                  aria-label={`Undo delete for ${task.title}`}
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
