/* ============================================
   FocusFlow Pro — FilterBar Component (v3)
   Uses dynamic categories from store
   ============================================ */

import store from '../store.js';
import { PRIORITIES } from '../utils/helpers.js';

export function renderFilterBar(container, onChange) {
    const bar = document.createElement('div');
    bar.className = 'filter-bar';

    const state = { search: '', category: 'all', priority: 'all', status: 'all', sort: 'default' };
    const categories = store.categories;

    bar.innerHTML = `
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input type="text" placeholder="Görev ara..." id="filter-search" />
    </div>
    <button class="filter-chip active" data-filter="status" data-value="all">Tümü</button>
    <button class="filter-chip" data-filter="status" data-value="active">Aktif</button>
    <button class="filter-chip" data-filter="status" data-value="completed">Tamamlanan</button>
    <div class="filter-divider"></div>
    <select class="filter-select" id="filter-category">
      <option value="all">Tüm Kategoriler</option>
      ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
    </select>
    <select class="filter-select" id="filter-priority">
      <option value="all">Tüm Öncelikler</option>
      ${PRIORITIES.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
    </select>
    <div class="filter-divider"></div>
    <button class="sort-btn" data-sort="priority" title="Önceliğe göre sırala">↕ Öncelik</button>
    <button class="sort-btn" data-sort="date" title="Tarihe göre sırala">↕ Tarih</button>
    <button class="sort-btn" data-sort="name" title="İsme göre sırala">↕ İsim</button>
  `;

    container.appendChild(bar);

    const searchInput = bar.querySelector('#filter-search');
    searchInput.addEventListener('input', () => { state.search = searchInput.value; onChange({ ...state }); });

    bar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            bar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state[chip.dataset.filter] = chip.dataset.value;
            onChange({ ...state });
        });
    });

    bar.querySelector('#filter-category').addEventListener('change', (e) => { state.category = e.target.value; onChange({ ...state }); });
    bar.querySelector('#filter-priority').addEventListener('change', (e) => { state.priority = e.target.value; onChange({ ...state }); });

    bar.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sortVal = btn.dataset.sort;
            state.sort = (state.sort === sortVal) ? 'default' : sortVal;
            bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('sort-active'));
            if (state.sort !== 'default') btn.classList.add('sort-active');
            onChange({ ...state });
        });
    });

    // Update categories dynamically
    store.on('categories-changed', () => {
        const catSelect = bar.querySelector('#filter-category');
        const cats = store.categories;
        catSelect.innerHTML = `<option value="all">Tüm Kategoriler</option>${cats.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}`;
    });

    return { bar, getState: () => ({ ...state }) };
}
