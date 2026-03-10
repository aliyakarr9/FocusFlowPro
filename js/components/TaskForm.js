/* ============================================
   FocusFlow Pro — TaskForm Component (v3)
   Uses dynamic categories from store
   ============================================ */

import store from '../store.js';
import { PRIORITIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../utils/helpers.js';

export function renderTaskForm(container, list = 'daily') {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-form-wrapper';

  const categories = store.categories;

  wrapper.innerHTML = `
    <div class="task-input-row">
      <span style="font-size:1.1rem;color:var(--accent)">+</span>
      <input type="text" id="task-input-${list}" placeholder="Yeni görev ekle..." autocomplete="off" />
      <button class="btn-add-task" id="btn-add-${list}">Ekle</button>
    </div>
    <div class="task-options-row">
      <select class="option-select" id="cat-select-${list}">
        ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
      </select>
      <select class="option-select" id="pri-select-${list}">
        ${PRIORITIES.map(p => `<option value="${p.id}" ${p.id === 'medium' ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
      <label class="date-label" title="En geç yapılması gereken tarih">⏰ Son teslim:</label>
      <input type="date" class="option-date" id="date-input-${list}" title="En geç yapılması gereken tarih" />
      <select class="option-select recurrence-select" id="rec-select-${list}" title="Tekrar sıklığı">
        <option value="none">🔄 Tekrar Yok</option>
        <option value="daily">📅 Her Gün</option>
        <option value="weekdays">🏢 Hafta İçi</option>
        <option value="weekly">📆 Her Hafta</option>
      </select>
      <button class="btn-manage-cats" id="manage-cats-${list}" title="Kategorileri yönet">⚙️</button>
    </div>
  `;

  container.prepend(wrapper);

  const input = document.getElementById(`task-input-${list}`);
  const btnAdd = document.getElementById(`btn-add-${list}`);
  const catSelect = document.getElementById(`cat-select-${list}`);
  const priSelect = document.getElementById(`pri-select-${list}`);
  const dateInput = document.getElementById(`date-input-${list}`);
  const recSelect = document.getElementById(`rec-select-${list}`);

  function addTask() {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    store.addTask({
      title,
      category: catSelect.value,
      priority: priSelect.value,
      dueDate: dateInput.value || '',
      list,
      recurrence: recSelect.value,
    });
    input.value = '';
    dateInput.value = '';
    recSelect.value = 'none';
    input.focus();
  }

  btnAdd.addEventListener('click', addTask);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

  // Manage categories button
  document.getElementById(`manage-cats-${list}`).addEventListener('click', () => {
    showCategoryManager();
  });

  // Re-render category options on change
  store.on('categories-changed', () => {
    const cats = store.categories;
    catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  });
}

function showCategoryManager() {
  document.querySelector('.modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  function render() {
    const categories = store.categories;
    overlay.innerHTML = `
      <div class="modal-box modal-wide">
        <div class="modal-header">
          <h3>⚙️ Kategori Yönetimi</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="cat-manager-list">
          ${categories.map(c => `
            <div class="cat-manager-item" data-id="${c.id}">
              <span class="cat-manager-icon" style="background:${c.color}">${c.icon}</span>
              <span class="cat-manager-name">${c.label}</span>
              <button class="cat-manager-delete" data-id="${c.id}" title="Sil">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="cat-add-section">
          <h4>Yeni Kategori Ekle</h4>
          <input type="text" class="cat-add-name" placeholder="Kategori adı" maxlength="20" />
          <div class="cat-icon-picker" id="cat-icon-picker">
            ${CATEGORY_ICONS.map((icon, i) => `<button class="cat-icon-option ${i === 0 ? 'selected' : ''}" data-icon="${icon}">${icon}</button>`).join('')}
          </div>
          <div class="cat-color-picker" id="cat-color-picker">
            ${CATEGORY_COLORS.map((color, i) => `<button class="cat-color-option ${i === 0 ? 'selected' : ''}" data-color="${color}" style="background:${color}"></button>`).join('')}
          </div>
          <button class="modal-btn-save" id="cat-add-btn">Kategori Ekle</button>
        </div>
      </div>
    `;

    // Close
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Delete
    overlay.querySelectorAll('.cat-manager-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = store.deleteCategory(btn.dataset.id);
        if (result === false) alert('En az 1 kategori kalmalı!');
        else render();
      });
    });

    // Icon picker
    let selectedIcon = CATEGORY_ICONS[0];
    overlay.querySelectorAll('.cat-icon-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.cat-icon-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedIcon = btn.dataset.icon;
      });
    });

    // Color picker
    let selectedColor = CATEGORY_COLORS[0];
    overlay.querySelectorAll('.cat-color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.cat-color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedColor = btn.dataset.color;
      });
    });

    // Add
    overlay.querySelector('#cat-add-btn').addEventListener('click', () => {
      const name = overlay.querySelector('.cat-add-name').value.trim();
      if (!name) return;
      const result = store.addCategory(name, selectedIcon, selectedColor);
      if (result === false) alert('Bu isimde bir kategori zaten var!');
      else render();
    });

    overlay.querySelector('.cat-add-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('#cat-add-btn').click();
    });
  }

  document.body.appendChild(overlay);
  render();
}
