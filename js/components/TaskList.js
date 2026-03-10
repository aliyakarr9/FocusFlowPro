/* ============================================
   FocusFlow Pro — TaskList Component (v2)
   ============================================ */

import store from '../store.js';
import { createTaskCard } from './TaskCard.js';
import { calculateProgress, sortTasks, filterTasks } from '../utils/helpers.js';

export function renderTaskList(container, list = 'daily', filters = {}, sortBy = 'default') {
  let progressSection = container.querySelector('.progress-section');
  let taskListEl = container.querySelector('.task-list');

  if (!progressSection) {
    progressSection = document.createElement('div');
    progressSection.className = 'progress-section';
    container.appendChild(progressSection);
  }

  if (!taskListEl) {
    taskListEl = document.createElement('div');
    taskListEl.className = 'task-list';
    container.appendChild(taskListEl);
  }

  const allTasks = store.getTasksByList(list);
  const progress = calculateProgress(allTasks);
  const completedCount = allTasks.filter(t => t.completed).length;

  // Progress bar + clear completed button
  progressSection.innerHTML = `
    <div class="progress-header">
      <span class="progress-title">${allTasks.length} görev · ${completedCount} tamamlandı</span>
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        ${completedCount > 0 ? `<button class="clear-completed-btn" id="clear-done-${list}">🧹 Temizle</button>` : ''}
        <span class="progress-percent">%${progress}</span>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${progress}%"></div>
    </div>
  `;

  // Clear completed handler
  const clearBtn = progressSection.querySelector(`#clear-done-${list}`);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      store.clearCompleted(list);
    });
  }

  // Filter & Sort
  let tasks = filterTasks(allTasks, filters);
  tasks = sortTasks(tasks, sortBy);

  // Render tasks
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    taskListEl.innerHTML = `
      <div class="task-list-empty">
        <div class="empty-icon">${allTasks.length === 0 ? '✨' : '🔍'}</div>
        <p>${allTasks.length === 0
        ? 'Henüz görev yok. Hadi bir tane ekle!'
        : 'Filtreyle eşleşen görev bulunamadı.'
      }</p>
      </div>
    `;
    return;
  }

  tasks.forEach(task => {
    const card = createTaskCard(task, { showMoveToDaily: list === 'weekly' });
    taskListEl.appendChild(card);
  });

  // Drag & drop reorder
  setupDragAndDrop(taskListEl, list);
}

function setupDragAndDrop(container, list) {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
    if (!dragging) return;
    const siblings = [...container.querySelectorAll('.task-card:not(.dragging)')];
    const afterEl = siblings.find(el => {
      const rect = el.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });
    if (afterEl) {
      container.insertBefore(dragging, afterEl);
    } else {
      container.appendChild(dragging);
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const cards = [...container.querySelectorAll('.task-card')];
    const newIndex = cards.findIndex(c => c.dataset.id === taskId);
    if (newIndex !== -1) {
      store.reorderTask(taskId, newIndex, list);
    }
  });
}
