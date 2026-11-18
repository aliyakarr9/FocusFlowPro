import store from '../store.js';
import { formatDate, isOverdue, isDueToday, PRIORITIES } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

// Satır yeniden çizilirken aynı seçeneklerle çizilsin diye saklanır
const lastOptions = new Map();

export function createTaskCard(task, options = {}) {
  lastOptions.set(task.id, options);
  const card = document.createElement('div');
  card.className = `task-card${task.completed ? ' completed' : ''}`;
  card.dataset.id = task.id;
  card.dataset.category = task.category || 'Genel';

  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  const priority = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1];
  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueToday = !task.completed && isDueToday(task.dueDate);
  const dueText = overdue ? overdueText(task.dueDate) : formatDate(task.dueDate);
  const title = displayTitle(task);
  const showMoveBtn = options.showMoveToDaily;
  const subtasks = task.subtasks || [];
  const subtaskDone = subtasks.filter(s => s.completed).length;
  const hasSubtasks = subtasks.length > 0;
  const recLabels = { daily: 'Her gün', weekdays: 'Hafta içi', weekly: 'Her hafta' };
  const recBadge = task.recurrence && task.recurrence !== 'none' ? recLabels[task.recurrence] : '';

  const categories = store.state.categories || [];
  const catInfo = categories.find(c => c.id === task.category);
  const catLabel = catInfo ? catInfo.label : (task.category || 'Genel');
  const catColor = catInfo ? catInfo.color : '#64748b';

  card.innerHTML = `
    <label class="task-checkbox">
      <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Tamamlandı" />
      <span class="checkmark"></span>
    </label>
    <div class="task-content">
      <div class="task-main">
        <div class="task-title" title="Adı değiştirmek için çift tıkla">${escapeHtml(title)}</div>
        <div class="task-meta">
          ${task.sourceId ? `<span class="task-linked" title="Haftalık listeden eklendi">${icon('calendar', 14)}</span>` : ''}
          ${task.priority === 'high' ? `<span class="task-flag" title="${priority.label}">${icon('flag', 14)}</span>` : ''}
          ${hasSubtasks ? `<span class="task-subtask-badge" title="Alt görevler">${icon('subtasks', 14)}${subtaskDone}/${subtasks.length}</span>` : ''}
          ${recBadge ? `<span class="task-recurrence">${icon('repeat', 14)}${recBadge}</span>` : ''}
          <span class="task-cat"><span class="cat-dot" style="background:${catColor}"></span>${escapeHtml(catLabel)}</span>
          ${dueText ? `<span class="task-due ${overdue ? 'overdue' : ''} ${dueToday ? 'today' : ''}">${dueText}</span>` : ''}
        </div>
      </div>
      ${task.notes ? `<div class="task-notes-preview">${icon('note', 14)}<span>${escapeHtml(task.notes.slice(0, 80))}${task.notes.length > 80 ? '...' : ''}</span></div>` : ''}
      ${hasSubtasks ? renderSubtaskList(task) : ''}
    </div>
    <div class="task-actions">
      ${showMoveBtn ? `<button class="task-action-btn move-daily" title="Bugüne ekle">${icon('sun', 16)}<span class="action-label">Bugüne ekle</span></button>` : ''}
      <button class="task-action-btn subtask-toggle" title="Alt görev ekle">${icon('subtasks', 16)}<span class="action-label">Alt görev</span></button>
      <button class="task-action-btn notes-btn" title="Not ekle veya düzenle">${icon('note', 16)}<span class="action-label">Not</span></button>
      <button class="task-action-btn edit" title="Düzenle">${icon('edit', 16)}<span class="action-label">Düzenle</span></button>
      <button class="task-action-btn delete" title="Görevi sil">${icon('trash', 16)}<span class="action-label">Sil</span></button>
    </div>
  `;

  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    store.toggleTask(task.id);
    if (!task.completed) triggerConfetti(card);
  });

  card.querySelector('.task-action-btn.delete').addEventListener('click', () => {
    card.classList.add('removing');
    setTimeout(() => store.deleteTask(task.id), 300);
  });

  // Düğme tüm alanları açar; başlığa çift tıklamak yalnızca adı değiştirir
  card.querySelector('.task-action-btn.edit').addEventListener('click', () => {
    showEditModal(task);
  });
  card.querySelector('.task-title').addEventListener('dblclick', () => {
    startInlineEdit(card, task);
  });

  card.querySelector('.task-action-btn.subtask-toggle').addEventListener('click', () => {
    showSubtaskInput(card, task);
  });

  card.querySelector('.task-action-btn.notes-btn').addEventListener('click', () => {
    showNotesModal(task);
  });

  if (showMoveBtn) {
    card.querySelector('.task-action-btn.move-daily').addEventListener('click', () => {
      const result = store.moveToDaily(task.id);
      if (result === false) {
        showToast('Bu görev zaten bugünün listesinde', 'warning');
      } else {
        showToast('Görev bugüne eklendi', 'success');
      }
    });
  }

  card.querySelectorAll('.subtask-check').forEach(cb => {
    cb.addEventListener('change', () => {
      store.toggleSubtask(task.id, cb.dataset.subId);
    });
  });

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
      // Kayıttan sonra liste yeniden çizilir, satır da onunla yenilenir
    } else {
      area.remove();
    }
  }

  input.addEventListener('blur', () => {
    // Enter'ın işlenmesi için kısa bekleme
    setTimeout(() => { if (!submitted) area.remove(); }, 100);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      submitted = true; // blur işleyicisi bir şey yapmasın
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
        <h3>${escapeHtml(displayTitle(task))}</h3>
        <button class="modal-close" aria-label="Kapat">${icon('x', 16)}</button>
      </div>
      <textarea class="modal-textarea" placeholder="Not ekle" aria-label="Not">${escapeHtml(task.notes || '')}</textarea>
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
    showToast('Not kaydedildi', 'success');
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      store.updateTask(task.id, { notes: textarea.value });
      close();
      showToast('Not kaydedildi', 'success');
    }
  });
}

function startInlineEdit(card, task) {
  const titleEl = card.querySelector('.task-title');
  if (!titleEl) return;
  const oldTitle = displayTitle(task);
  titleEl.outerHTML = `<input type="text" class="task-title-input" value="${escapeAttr(oldTitle)}" />`;

  const input = card.querySelector('.task-title-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  function finish() {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== oldTitle) {
      store.updateTask(task.id, { title: newTitle });
    } else {
      // Değişiklik yok: satırı baştan çiz ki çift tıklama yeniden çalışsın
      card.replaceWith(createTaskCard(task, lastOptions.get(task.id) || {}));
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
    p.style.background = ['#cc4125', '#e05a38', '#e0a33a', '#f2c879', '#5dbb86', '#d6ccbe'][Math.floor(Math.random() * 6)];
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`);
    p.style.setProperty('--y', `${-60 - Math.random() * 80}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

/* Kısa bildirim. type 'delete' ise son silinen görevi geri alan düğme çıkar;
   action = { label, onAction } verilirse onun yerine o düğme gösterilir. */
export function showToast(message, type = 'info', action = null) {
  document.querySelector('.toast-notification')?.remove();

  const act = action || (type === 'delete' ? {
    label: 'Geri al',
    onAction: () => {
      if (store.undoDelete()) showToast('Görev geri alındı', 'success');
    },
  } : null);

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  if (act) {
    const btn = document.createElement('button');
    btn.className = 'toast-undo';
    btn.textContent = act.label;
    btn.addEventListener('click', () => {
      toast.remove();
      act.onAction();
    });
    toast.appendChild(btn);
  }
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, act ? 6000 : 2500);
}

/* Eski sürümde haftalıktan kopyalanan görevlerin başına eklenen işaret gösterilmez. */
function displayTitle(task) {
  return String(task.title || '').replace(/^\u{1F517}\s*/u, '');
}

/* Görev düzenleme penceresi */
function showEditModal(task) {
  document.querySelector('.modal-overlay')?.remove();
  const categories = store.categories;
  const current = store.tasks.find(t => t.id === task.id) || task;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <form class="modal-box modal-wide task-edit" role="dialog" aria-label="Görevi düzenle">
      <div class="modal-header">
        <h3>Görevi düzenle</h3>
        <button type="button" class="modal-close" aria-label="Kapat">${icon('x', 16)}</button>
      </div>
      <label class="field">
        <span class="field-label">Görev</span>
        <input type="text" class="input" id="edit-title" value="${escapeAttr(displayTitle(current))}" autocomplete="off" />
      </label>
      <div class="task-edit-grid">
        <label class="field">
          <span class="field-label">Kategori</span>
          <select class="select" id="edit-category">
            ${categories.map(c => `<option value="${escapeAttr(c.id)}" ${c.id === current.category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Tekrar</span>
          <select class="select" id="edit-recurrence">
            <option value="none">Tekrar yok</option>
            <option value="daily">Her gün</option>
            <option value="weekdays">Hafta içi</option>
            <option value="weekly">Her hafta</option>
          </select>
        </label>
        <div class="field">
          <span class="field-label">Zorluk</span>
          <div class="segmented" id="edit-priority">
            ${PRIORITIES.map(p => `<button type="button" data-value="${p.id}" class="${p.id === (current.priority || 'medium') ? 'active' : ''}">${p.label}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span class="field-label">Liste</span>
          <div class="segmented" id="edit-list">
            <button type="button" data-value="daily" class="${current.list === 'daily' ? 'active' : ''}">Bugün</button>
            <button type="button" data-value="weekly" class="${current.list === 'weekly' ? 'active' : ''}">Haftalık</button>
          </div>
        </div>
        <div class="field task-edit-date">
          <span class="field-label">Son teslim</span>
          <div class="task-edit-date-row">
            <input type="date" class="input" id="edit-due" value="${escapeAttr(current.dueDate || '')}" aria-label="Son teslim" />
            <button type="button" class="btn btn-sm" data-due="0">Bugün</button>
            <button type="button" class="btn btn-sm" data-due="1">Yarın</button>
            <button type="button" class="btn btn-sm btn-ghost" data-due="clear">Kaldır</button>
          </div>
        </div>
      </div>
      <label class="field">
        <span class="field-label">Not</span>
        <textarea class="textarea" id="edit-notes" placeholder="Not ekle">${escapeHtml(current.notes || '')}</textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="modal-btn-cancel">Vazgeç</button>
        <button type="submit" class="modal-btn-save">Kaydet</button>
      </div>
    </form>
  `;
  document.body.appendChild(overlay);

  const $ = (sel) => overlay.querySelector(sel);
  $('#edit-recurrence').value = current.recurrence || 'none';
  const titleInput = $('#edit-title');
  titleInput.focus();
  titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);

  overlay.querySelectorAll('.segmented').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      group.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
  const selected = (id) => $(`#${id} button.active`)?.dataset.value;

  overlay.querySelectorAll('[data-due]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.due === 'clear') { $('#edit-due').value = ''; return; }
      const d = new Date();
      d.setDate(d.getDate() + Number(btn.dataset.due));
      $('#edit-due').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  });

  const close = () => overlay.remove();
  $('.modal-close').addEventListener('click', close);
  $('.modal-btn-cancel').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    close();
    store.updateTask(task.id, {
      title,
      category: $('#edit-category').value,
      recurrence: $('#edit-recurrence').value,
      priority: selected('edit-priority') || 'medium',
      list: selected('edit-list') || current.list,
      dueDate: $('#edit-due').value || '',
      notes: $('#edit-notes').value,
    });
    showToast('Görev güncellendi', 'success');
  });

  // Not alanında Ctrl/Cmd + Enter kaydeder
  $('#edit-notes').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('form').requestSubmit();
  });
}

function overdueText(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - target) / (1000 * 60 * 60 * 24));
  return `${days} gün gecikti`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
