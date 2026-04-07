import { useState } from 'react';
import TaskCard from './TaskCard';

export default function TaskList({
  activeTasks, completedTasks, settings,
  completeTask, deleteTask, resetTask, deferTask, moveUp, moveDown, moveToTop, moveToBottom,
  playTask, toggleTaskFlag, currentTaskId, timerRunning,
  emojiMe, colorMe, randomTask, addOvertime, clearActiveTasks,
  showAddForm, setShowAddForm,
}) {
  const [showCompleted, setShowCompleted] = useState(settings.showCompletedByDefault);

  return (
    <section className="task-list-section">

      {/* Quick action buttons */}
      <div className="quick-actions">
        <button className="quick-btn" onClick={emojiMe} title="Assign random emoji to current task">🎲 Emoji Me!</button>
        <button className="quick-btn" onClick={colorMe} title="Assign random color to current task">🎨 Color Me!</button>
        <button className="quick-btn" onClick={randomTask} title="Pick a random task as current">🔀 Random</button>
        <button className="quick-btn" onClick={() => addOvertime(5)} title="Add 5 minutes to current task">⏱ +Overtime</button>
        <button className="quick-btn quick-btn--danger" onClick={clearActiveTasks} title="Clear all active tasks">🗑 Clear</button>
      </div>

      {/* Active task list */}
      <div className="task-list">
        {activeTasks.length === 0 && (
          <p className="list-empty">No active tasks — add one below!</p>
        )}
        {activeTasks.map((task, idx) => (
          <TaskCard
            key={task.id}
            task={task}
            isFirst={idx === 0}
            index={idx}
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
            currentTaskId={currentTaskId}
            timerRunning={timerRunning}
          />
        ))}
      </div>

      <button className="add-task-btn" onClick={() => setShowAddForm(true)}>
        + Add Task
      </button>

      {/* Completed tasks collapsible */}
      <div className="completed-section">
        <button className="toggle-btn" onClick={() => setShowCompleted(s => !s)}>
          {showCompleted ? '▲' : '▼'} Completed ({completedTasks.length})
        </button>
        {showCompleted && (
          <div className="completed-list">
            {completedTasks.length === 0 && (
              <p className="list-empty">No completed tasks yet.</p>
            )}
            {[...completedTasks].reverse().map(task => (
              <div key={task.id} className="completed-task">
                <span>{task.emoji}</span>
                <span className="completed-task__title">{task.title}</span>
                <span className="completed-task__meta">
                  {task.estimatedMinutes}m est · {Math.round(task.spentSeconds / 60)}m spent
                </span>
                <span className="completed-task__time">
                  {new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
