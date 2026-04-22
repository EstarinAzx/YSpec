import { saveTask, loadTasks } from './db.js';

/**
 * @param {string} title
 * @param {number} priority
 * @returns {object}
 */
export async function addTask(title, priority) {
  let task = { title: title, priority: priority, done: false, createdAt: Date.now() };
  try {
    let saved = await saveTask(task);
    return saved;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new TaskCreationError(Failed to save task);
    } else {
      throw error;
    }
  }
}

/**
 * @param {string} userId
 * @returns {list<object>}
 */
export async function getActiveTasks(userId) {
  let allTasks = await loadTasks(userId);
  let active = [];
  for (const task of allTasks) {
    if (not task.done) {
      active.push(task);
    }
  }
  return active;
}

