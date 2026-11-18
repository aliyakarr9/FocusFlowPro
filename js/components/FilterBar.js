import store from '../store.js';
import { PRIORITIES } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderFilterBar(container, onChange) {
    const bar = document.createElement('div');
    bar.className = 'filter-bar';

    const state = { search: '', category: 'all', priority: 'all', status: 'all', sort: 'default' };
    const categories = store.categories;

    bar.innerHTML = `
    <div class="search-box">
      <span class="search-icon">${icon('search', 16)}</span>
      <input type="text" placeholder="Görev ara" id="filter-search" />
    </div>
    <div class="filter-status">
      <button class="filter-chip active" data-filter="status" data-value="all">Tümü</button>
      <button class="filter-chip" data-filter="status" data-value="active">Aktif</button>
      <button class="filter-chip" data-filter="status" data-value="completed">Tamamlanan</button>
    </div>
    <button class="filter-toggle" id="filter-toggle" aria-expanded="false">${icon('filter', 16)}<span>Filtrele</span></button>
    <div class="filter-more">
      <select class="filter-select" id="filter-category">
        <option value="all">Tüm kategoriler</option>
        ${categories.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}
      </select>
      <select class="filter-select" id="filter-priority">
        <option value="all">Tüm zorluklar</option>
        ${PRIORITIES.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
      </select>
      <div class="filter-divider"></div>
      <button class="sort-btn" data-sort="priority" title="Zorluğa göre sırala">${icon('sort', 14)}Zorluk</button>
      <button class="sort-btn" data-sort="date" title="Tarihe göre sırala">${icon('sort', 14)}Tarih</button>
      <button class="sort-btn" data-sort="name" title="İsme göre sırala">${icon('sort', 14)}İsim</button>
    </div>
  `;

    container.appendChild(bar);

    // Kategori, zorluk ve sıralama "Filtrele" ile açılır
    const toggle = bar.querySelector('#filter-toggle');
    const markActive = () => {
        toggle.classList.toggle('has-active', state.category !== 'all' || state.priority !== 'all' || state.sort !== 'default');
    };
    toggle.addEventListener('click', () => {
        const open = bar.classList.toggle('expanded');
        toggle.setAttribute('aria-expanded', String(open));
    });

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

    bar.querySelector('#filter-category').addEventListener('change', (e) => { state.category = e.target.value; markActive(); onChange({ ...state }); });
    bar.querySelector('#filter-priority').addEventListener('change', (e) => { state.priority = e.target.value; markActive(); onChange({ ...state }); });

    bar.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sortVal = btn.dataset.sort;
            state.sort = (state.sort === sortVal) ? 'default' : sortVal;
            bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('sort-active'));
            if (state.sort !== 'default') btn.classList.add('sort-active');
            markActive();
            onChange({ ...state });
        });
    });

    store.on('categories-changed', () => {
        const catSelect = bar.querySelector('#filter-category');
        const cats = store.categories;
        catSelect.innerHTML = `<option value="all">Tüm kategoriler</option>${cats.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}`;
    });

    return { bar, getState: () => ({ ...state }) };
}
