# Prototype Data Notes

## Added in prototype/main-task-order-controls

### `fst_pin_active_to_top` (localStorage, boolean, default `true`)

Controls whether activating or focusing a main task visually and structurally moves it to position 0 in the list.

- `true` (default) — preserves existing behavior: active task is always at the top
- `false` — manual order wins; activating a task does not reorder the array

### `orderedTasks` (derived, not stored)

Computed in `MainTaskContext` from `mainTasks`, `activeMainTaskId`, and `pinActiveToTop`.

- When `pinActiveToTop` is `true`: full task array sorted so active task is first
- When `pinActiveToTop` is `false`: full task array in raw insertion/manual order
- All consumers (`MainTaskList`, `MainTaskCard`) read from this single derived value — no local copies

---

## Main task ordering model

- **Array-position-based.** There is no explicit `order` or `manualOrder` field on task objects.
- Order is determined entirely by the index of each task in the `mainTasks` array stored in `fst_main_tasks` (localStorage).
- `moveMainTaskUp(id)` / `moveMainTaskDown(id)` swap adjacent items in the raw array and persist immediately.
- Drag-and-drop (`reorderMainTask(dragId, targetId)`) splices items into a new position in the raw array.

---

## How active-task pinning currently works (before this change)

Two separate mechanisms forced the active task to the top:

1. **Visual sort** — `orderedFiltered` in `MainTaskList.jsx` sorted the filtered display list so the active task always appeared at index 0. This was local component state, not persisted.
2. **Array reorder** — `handleSetActive`, `handleFocusTask`, and `handleFocusStep` in `MainTaskCard.jsx` each called `reorderMainTask(task.id, mainTasks[0].id)`, physically moving the task to position 0 in the stored array.

Both mechanisms are now gated by `pinActiveToTop`.

---

## Future database considerations

If this app moves to a backend database, the following fields would likely be needed:

| Concern                      | Suggested DB field                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stable manual task order     | `manualOrder: number` on the task record (e.g. float for gap-based reordering)                                       |
| Pin-active-to-top preference | `pinActiveToTop: boolean` in a user settings table                                                                   |
| Ordered task fetching        | Query tasks `ORDER BY manualOrder ASC` when pin is OFF; `ORDER BY (id = activeTaskId) DESC, manualOrder ASC` when ON |

The current array-position model translates cleanly to an integer `manualOrder` field updated on every move operation.
