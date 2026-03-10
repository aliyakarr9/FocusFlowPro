/* ============================================
   FocusFlow Pro — TaskCard Component (v3)
   Fixed: subtask duplication, better icons, 
   better subtask UI, notes modal
   ============================================ */

import store from '../store.js';
import { formatDate, isOverdue, getUrgencyLevel, getUrgencyLabel, PRIORITIES } from '../utils/helpers.js';

export function createTaskCard(task, options = {}) {
  const card = document.createElement('div');
  card.className = `task-card${task.completed ? ' completed' : ''}`;
  card.dataset.id = task.id;
  card.dataset.category = task.category || 'Genel';

  // Draggable
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  const priority = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1];
  const dueDateStr = formatDate(task.dueDate);
  const overdue = !task.completed && isOverdue(task.dueDate);
  const urgency = !task.completed ? getUrgencyLevel(task.dueDate) : null;
  const urgencyLabel = getUrgencyLabel(urgency);
  const showMoveBtn = options.showMoveToDaily;
  const subtasks = task.subtasks || [];
  const subtaskDone = subtasks.filter(s => s.completed).length;
  const hasSubtasks = subtasks.length > 0;
  const recLabels = { daily: '🔁 Her Gün', weekdays: '🏢 Hafta İçi', weekly: '📆 Her Hafta' };
  const recBadge = task.recurrence && task.recurrence !== 'none' ? recLabels[task.recurrence] : '';

  // Find category info
  const categories = store.state.categories || [];
  const catInfo = categories.find(c => c.id === task.category);
  const catLabel = catInfo ? `${catInfo.icon} ${catInfo.label}` : (task.category || 'Genel');
  const catColor = catInfo ? catInfo.color : '#64748b';

  // Urgency CSS class
  if (urgency) card.classList.add(`urgency-${urgency}`);

  // Apply dynamic category color as CSS variable
  card.style.setProperty('--cat-color', catColor);

  card.innerHTML = `
    <label class="task-checkbox">
      <input type="checkbox" ${task.completed ? 'checked' : ''} />
      <span class="checkmark"></span>
    </label>
    <div class="task-content">
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.notes ? `<div class="task-notes-preview">📝 ${escapeHtml(task.notes.slice(0, 80))}${task.notes.length > 80 ? '...' : ''}</div>` : ''}
      <div class="task-meta">
        <span class="task-tag ${priority.cssClass}">${priority.label}</span>
        <span class="task-tag category" style="--tag-color: ${catColor}"><span class="cat-dot" style="background:${catColor}"></span>${catLabel}</span>
        ${dueDateStr ? `<span class="task-due ${overdue ? 'overdue' : ''}">📅 ${dueDateStr}</span>` : ''}
        ${urgencyLabel ? `<span class="urgency-badge urgency-${urgency}">${urgencyLabel}</span>` : ''}
        ${hasSubtasks ? `<span class="task-subtask-badge">✅ ${subtaskDone}/${subtasks.length}</span>` : ''}
        ${recBadge ? `<span class="task-tag recurrence-tag">${recBadge}</span>` : ''}
      </div>
      ${hasSubtasks ? renderSubtaskList(task) : ''}
    </div>
    <div class="task-actions">
      ${showMoveBtn ? `<button class="task-action-btn move-daily" title="Günlüğe aktar"><span class="action-icon">📋</span><span class="action-label">Bugüne Ekle</span></button>` : ''}
      <button class="task-action-btn subtask-toggle" title="Alt görev ekle"><span class="action-icon">➕</span><span class="action-label">Alt Görev</span></button>
      <button class="task-action-btn notes-btn" title="Not ekle/düzenle"><span class="action-icon">📝</span><span class="action-label">Not</span></button>
      <button class="task-action-btn edit" title="Görevi düzenle"><span class="action-icon">✏️</span><span class="action-label">Düzenle</span></button>
      <button class="task-action-btn delete" title="Görevi sil"><span class="action-icon">🗑️</span><span class="action-label">Sil</span></button>
    </div>
  `;

  // Checkbox toggle
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    store.toggleTask(task.id);
    if (!task.completed) triggerConfetti(card);
  });

  // Delete
  card.querySelector('.task-action-btn.delete').addEventListener('click', () => {
    card.classList.add('removing');
    setTimeout(() => store.deleteTask(task.id), 300);
  });

  // Edit
  card.querySelector('.task-action-btn.edit').addEventListener('click', () => {
    startInlineEdit(card, task);
  });

  // Add subtask
  card.querySelector('.task-action-btn.subtask-toggle').addEventListener('click', () => {
    showSubtaskInput(card, task);
  });

  // Notes
  card.querySelector('.task-action-btn.notes-btn').addEventListener('click', () => {
    showNotesModal(task);
  });

  // Move to daily
  if (showMoveBtn) {
    card.querySelector('.task-action-btn.move-daily').addEventListener('click', () => {
      const result = store.moveToDaily(task.id);
      if (result === false) {
        showToast('Bu görev zaten günlük listende!', 'warning');
      } else {
        showToast('Görev günlüğe aktarıldı ✅', 'success');
      }
    });
  }

  // Subtask checkboxes
  card.querySelectorAll('.subtask-check').forEach(cb => {
    cb.addEventListener('change', () => {
      store.toggleSubtask(task.id, cb.dataset.subId);
    });
  });

  // Subtask delete
  card.querySelectorAll('.subtask-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteSubtask(task.id, btn.dataset.subId);
    });
  });

  return card;
}

function renderSubtaskList(task) {
  const subs = task.subtasks || [];
  if (subs.length === 0) return '';
  return `<div class="subtask-list">${subs.map(s => `
    <div class="subtask-item ${s.completed ? 'done' : ''}">
      <label class="subtask-checkbox-label">
        <input type="checkbox" class="subtask-check" data-sub-id="${s.id}" ${s.completed ? 'checked' : ''} />
        <span class="subtask-checkmark"></span>
      </label>
      <span class="subtask-text">${escapeHtml(s.title)}</span>
      <button class="subtask-del-btn" data-sub-id="${s.id}" title="Alt görevi sil">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </button>
    </div>
  `).join('')}</div>`;
}

function showSubtaskInput(card, task) {
  // Prevent duplicate input
  const existing = card.querySelector('.subtask-add-area');
  if (existing) { existing.querySelector('input')?.focus(); return; }

  const wrapper = card.querySelector('.task-content');
  const area = document.createElement('div');
  area.className = 'subtask-add-area';
  area.innerHTML = `
    <div class="subtask-add-row">
      <span class="subtask-add-icon">+</span>
      <input type="text" class="subtask-add-input" placeholder="Alt görev yaz..." />
    </div>
  `;
  wrapper.appendChild(area);

  const input = area.querySelector('.subtask-add-input');
  input.focus();

  let submitted = false;

  function submit() {
    if (submitted) return;
    const val = input.value.trim();
    if (val) {
      submitted = true;
      store.addSubtask(task.id, val);
      // The re-render from store event will rebuild the card
    } else {
      area.remove();
    }
  }

  input.addEventListener('blur', () => {
    // Small delay to allow Enter to fire first
    setTimeout(() => { if (!submitted) area.remove(); }, 100);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      submitted = true; // prevent blur handler from doing anything
      area.remove();
    }
  });
}

function showNotesModal(task) {
  document.querySelector('.modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>📝 ${escapeHtml(task.title)}</h3>
        <button class="modal-close">✕</button>
      </div>
      <textarea class="modal-textarea" placeholder="Notlarını buraya yaz...">${escapeHtml(task.notes || '')}</textarea>
      <div class="modal-actions">
        <button class="modal-btn-cancel">İptal</button>
        <button class="modal-btn-save">Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('.modal-textarea');
  textarea.focus();

  function close() { overlay.remove(); }

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
  overlay.querySelector('.modal-btn-save').addEventListener('click', () => {
    store.updateTask(task.id, { notes: textarea.value });
    close();
    showToast('Not kaydedildi ✅', 'success');
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Ctrl+Enter to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      store.updateTask(task.id, { notes: textarea.value });
      close();
      showToast('Not kaydedildi ✅', 'success');
    }
  });
}

function startInlineEdit(card, task) {
  const titleEl = card.querySelector('.task-title');
  const oldTitle = task.title;
  titleEl.outerHTML = `<input type="text" class="task-title-input" value="${escapeAttr(oldTitle)}" />`;

  const input = card.querySelector('.task-title-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  function finish() {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== oldTitle) {
      store.updateTask(task.id, { title: newTitle });
    } else {
      input.outerHTML = `<div class="task-title">${escapeHtml(oldTitle)}</div>`;
    }
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
  });
}

function triggerConfetti(card) {
  const rect = card.getBoundingClientRect();
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 60}px`;
    p.style.top = `${rect.top + 10}px`;
    p.style.background = ['#818cf8', '#a78bfa', '#34d399', '#fbbf24', '#fb923c', '#f87171'][Math.floor(Math.random() * 6)];
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`);
    p.style.setProperty('--y', `${-60 - Math.random() * 80}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

export function showToast(message, type = 'info') {
  document.querySelector('.toast-notification')?.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    ${type === 'delete' ? '<button class="toast-undo">Geri Al</button>' : ''}
  `;
  document.body.appendChild(toast);

  if (type === 'delete') {
    toast.querySelector('.toast-undo')?.addEventListener('click', () => {
      store.undoDelete();
      toast.remove();
      showToast('Görev geri alındı! ✅', 'success');
    });
  }

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, type === 'delete' ? 5000 : 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
