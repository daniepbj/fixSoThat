function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_TASK_DURATION = 2

function clampMinutes(value, fallback = DEFAULT_TASK_DURATION) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(60, Math.round(num)));
}

/** Build a task object, merging any overrides. */
export function createTask(overrides = {}) {
  const estimatedMinutes = clampMinutes(overrides.estimatedMinutes, DEFAULT_TASK_DURATION);
  const {
    id: _discard,
    adhdFlags: overrideFlags,
    ...rest
  } = overrides; // always generate a fresh id

  const adhdFlags = {
    needsSteps: false,
    needsTime: false,
    needsProof: false,
    priority: false,
    ...(overrideFlags || {}),
  };

  return {
    id: uid(),
    title: 'New Task',
    emoji: '✏️',
    color: '#6c63ff',
    estimatedMinutes,
    remainingSeconds: estimatedMinutes * 60,
    spentSeconds: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    adhdFlags,
    ...rest,
  };
}

export const SEED_TASKS = [
  createTask({ title: 'Review pull requests', emoji: '👀', color: '#6c63ff', estimatedMinutes: 25 }),
  createTask({ title: 'Write design doc', emoji: '✍️', color: '#f59e0b', estimatedMinutes: 30 }),
  createTask({ title: 'Team standup', emoji: '🧑‍💻', color: '#10b981', estimatedMinutes: 15 }),
  createTask({ title: 'Fix login bug', emoji: '🐛', color: '#ef4444', estimatedMinutes: 20 }),
  createTask({ title: 'Update README', emoji: '📝', color: '#3b82f6', estimatedMinutes: 10 }),
];

export const SEED_SETTINGS = {
  soundEnabled: false,
  autoStartNextTask: true,
  autoScrollOnAlarm: true,
  defaultTaskDuration: DEFAULT_TASK_DURATION,
  showCompletedByDefault: false,
  matchMainPageStyle: true,
  alarmMode: 'nag',
  idlePromptSeconds: 30,
  pomodoroEnabled: true,
  pomodoroWorkMinutes: 20,
  pomodoroBreakMinutes: 5,
};

export const SEED_PRESETS = [
  {
    id: uid(),
    name: 'Morning Focus',
    tasks: [
      createTask({ title: 'Check emails', emoji: '📧', color: '#6c63ff', estimatedMinutes: 10 }),
      createTask({ title: 'Daily planning', emoji: '🗓️', color: '#10b981', estimatedMinutes: 15 }),
      createTask({ title: 'Deep work block', emoji: '🎯', color: '#f59e0b', estimatedMinutes: 50 }),
    ],
  },
];

export const EMOJIS = ['🎯', '🚀', '💡', '⚡', '🔥', '🌟', '🎨', '🧩', '🏆', '🦾', '📝', '🐛', '📧', '🗓️', '✏️', '👀', '✍️', '🧑‍💻'];
export const COLORS = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

/**
 * Seeds localStorage on the very first load.
 * Once the `fst_v1_init` flag is set, this is a no-op —
 * so deleting / completing all tasks never re-populates them.
 */
export function initStorageIfNew() {
  if (localStorage.getItem('fst_v1_init')) return;

  const knownKeys = ['fst_active', 'fst_completed', 'fst_deferred', 'fst_settings', 'fst_presets'];
  const hasExistingState = knownKeys.some((k) => localStorage.getItem(k) !== null);

  // Existing users: do not overwrite data. Just ensure required keys exist.
  if (hasExistingState) {
    if (localStorage.getItem('fst_active') === null) localStorage.setItem('fst_active', JSON.stringify([]));
    if (localStorage.getItem('fst_completed') === null) localStorage.setItem('fst_completed', JSON.stringify([]));
    if (localStorage.getItem('fst_deferred') === null) localStorage.setItem('fst_deferred', JSON.stringify([]));
    if (localStorage.getItem('fst_presets') === null) localStorage.setItem('fst_presets', JSON.stringify(SEED_PRESETS));
    if (localStorage.getItem('fst_settings') === null) localStorage.setItem('fst_settings', JSON.stringify(SEED_SETTINGS));
    localStorage.setItem('fst_v1_init', '1');
    return;
  }

  // Brand-new users get seeded demo data once.
  localStorage.setItem('fst_active', JSON.stringify(SEED_TASKS));
  localStorage.setItem('fst_completed', JSON.stringify([]));
  localStorage.setItem('fst_deferred', JSON.stringify([]));
  localStorage.setItem('fst_settings', JSON.stringify(SEED_SETTINGS));
  localStorage.setItem('fst_presets', JSON.stringify(SEED_PRESETS));
  localStorage.setItem('fst_v1_init', '1');
}
