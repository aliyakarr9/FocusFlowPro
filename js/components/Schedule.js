import store from '../store.js';
import { showToast } from './TaskCard.js';
import { generateId } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const WEEKDAYS = DAY_NAMES.slice(0, 5);
const PRIORITY_LABELS = { low: 'Kolay', medium: 'Orta', high: 'Zor' };

const CSV_EXAMPLE = [
    'Saat,Pazartesi,Salı,Çarşamba,Perşembe,Cuma',
    '08:30 - 09:20,Matematik,Fizik,,Kimya,Biyoloji',
    '09:30 - 10:20,Matematik,,Tarih,Kimya,',
    '10:30 - 11:20,,Edebiyat,Tarih,,İngilizce',
].join('\n');

/* İçe aktarma ekranına geçerken metin alanına konacak CSV (yeniden içe aktarma) */
let pendingCsv = '';

function getTodayName() {
    const jsDay = new Date().getDay(); // 0 = pazar
    return DAY_NAMES[jsDay === 0 ? 6 : jsDay - 1];
}

/* "08:30 - 09:20" gibi saatleri başlangıca göre sıralamak için */
function parseTimeStart(timeStr) {
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
    if (!match) return 9999;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/* Serbest yazılmış saat aralığını "HH:MM - HH:MM" biçimine getirir; geçersizse null */
function normalizeTimeRange(input) {
    const matches = [...String(input).matchAll(/(\d{1,2})[:.](\d{2})/g)].slice(0, 2);
    if (matches.length === 0) return null;
    const parts = [];
    for (const m of matches) {
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        if (h > 23 || min > 59) return null;
        parts.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return parts.join(' - ');
}

/* Başlıktaki gün adını DAY_NAMES içindeki yazımla eşleştirir */
function matchDayName(raw) {
    const key = String(raw).trim().toLocaleLowerCase('tr-TR');
    return DAY_NAMES.find(d => d.toLocaleLowerCase('tr-TR') === key) || null;
}

function safeColor(color) {
    if (typeof color !== 'string' || !color) return '';
    try {
        return window.CSS?.supports?.('color', color) ? color : '';
    } catch {
        return '';
    }
}

function defaultCategoryId() {
    const cats = store.categories;
    return (cats.find(c => c.id === 'Genel') || cats[0])?.id || 'Genel';
}

function categoryOptions(selectedId) {
    return store.categories.map(c =>
        `<option value="${escapeAttr(c.id)}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml(c.label)}</option>`
    ).join('');
}

/* Ana çizim */
export function renderSchedule(container) {
    container.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'schedule-page';
    container.appendChild(page);

    if (store.weeklySchedule.length === 0) {
        renderImportView(page);
    } else {
        renderTimetable(page);
    }
}

/* İçe aktarma ekranı */
function renderImportView(page) {
    const csvValue = pendingCsv;
    pendingCsv = '';

    const card = document.createElement('section');
    card.className = 'card schedule-import';
    card.innerHTML = `
        <div class="schedule-import-head">
            <h3 class="section-title">Ders programını içe aktar</h3>
            <p class="section-hint">Tablonuzu CSV olarak yapıştırın ya da dersleri tek tek ekleyin.</p>
        </div>
        <div class="field">
            <label class="field-label" for="schedule-csv">CSV metni</label>
            <textarea class="textarea schedule-csv" id="schedule-csv" rows="9" spellcheck="false"
                placeholder="Saat,Pazartesi,Salı,Çarşamba&#10;08:30 - 09:20,Matematik,Fizik,"></textarea>
        </div>
        <ul class="schedule-format">
            <li>İlk satır: <span class="schedule-code">Saat</span>, ardından gün adları (Pazartesi, Salı …).</li>
            <li>Sonraki satırlar: saat aralığı ve her gün için ders adı. Boş hücreler atlanır.</li>
        </ul>
        <div class="schedule-import-actions">
            <button type="button" class="btn btn-ghost" id="btn-schedule-manual">${icon('plus', 16)}<span>İlk dersi elle ekle</span></button>
            <div class="schedule-import-main">
                <button type="button" class="btn" id="btn-schedule-example">${icon('copy', 16)}<span>Örnek doldur</span></button>
                <button type="button" class="btn btn-primary" id="btn-parse-csv">${icon('upload', 16)}<span>İçe aktar</span></button>
            </div>
        </div>
    `;
    page.appendChild(card);

    const textarea = card.querySelector('#schedule-csv');
    if (csvValue) textarea.value = csvValue;

    card.querySelector('#btn-schedule-example').addEventListener('click', () => {
        if (textarea.value.trim() && textarea.value.trim() !== CSV_EXAMPLE) {
            showToast('Örnek, mevcut metnin yerine yazıldı', 'info');
        }
        textarea.value = CSV_EXAMPLE;
        textarea.focus();
    });

    card.querySelector('#btn-schedule-manual').addEventListener('click', () => {
        showEntryModal({ day: getTodayName() === 'Cumartesi' || getTodayName() === 'Pazar' ? 'Pazartesi' : getTodayName() });
    });

    card.querySelector('#btn-parse-csv').addEventListener('click', () => {
        const csv = textarea.value.trim();
        if (!csv) { showToast('Önce CSV metnini yapıştırın', 'warning'); textarea.focus(); return; }
        const result = parseCSV(csv);
        if (result.error) { showToast(result.error, 'warning'); return; }
        if (result.entries.length === 0) { showToast('Metinde ders bulunamadı', 'warning'); return; }
        if (result.skippedColumns.length > 0) {
            showToast(`Tanınmayan sütunlar atlandı: ${result.skippedColumns.join(', ')}`, 'info');
        }
        const uniqueActivities = [...new Set(result.entries.map(e => e.activity))];
        showCategoryMappingModal(uniqueActivities, result.entries);
    });
}

/* CSV ayrıştırma */
function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { entries: [], skippedColumns: [], error: 'En az bir başlık ve bir ders satırı gerekli' };

    const headers = splitCSVLine(lines[0]).map(h => h.trim());
    const dayColumns = headers.slice(1).map(matchDayName); // İlk sütun saat
    const skippedColumns = headers.slice(1).filter((h, i) => h && !dayColumns[i]);
    if (!dayColumns.some(Boolean)) {
        return { entries: [], skippedColumns, error: 'Başlık satırında gün adı bulunamadı' };
    }

    const entries = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i]);
        const time = cols[0]?.trim();
        if (!time) continue;

        for (let d = 0; d < dayColumns.length; d++) {
            const day = dayColumns[d];
            const activity = (cols[d + 1] || '').trim();
            if (!day || !activity) continue;
            entries.push({
                id: generateId(),
                time,
                day,
                activity,
                category: 'Genel',
                priority: 'medium',
            });
        }
    }
    return { entries, skippedColumns, error: null };
}

function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
        current += ch;
    }
    result.push(current);
    return result;
}

function csvCell(value) {
    const s = String(value ?? '');
    return /[",]/.test(s) ? `"${s.replace(/"/g, '')}"` : s;
}

/* Mevcut programı içe aktarma biçimine çevirir */
function scheduleToCSV(schedule) {
    const days = DAY_NAMES.filter(d => schedule.some(e => e.day === d));
    const times = [...new Set(schedule.map(e => e.time))].sort((a, b) => parseTimeStart(a) - parseTimeStart(b));
    const rows = [['Saat', ...days].join(',')];
    times.forEach(time => {
        const cells = days.map(day => csvCell(schedule.find(e => e.time === time && e.day === day)?.activity || ''));
        rows.push([csvCell(time), ...cells].join(','));
    });
    return rows.join('\n');
}

/* Pencere altyapısı */
let activeModal = null;

function closeActiveModal() {
    if (activeModal) activeModal.close();
}

/** Ortak pencere: başlık, gövde ve alt düğmeler. Esc kapatır; onEnter verilirse metin alanında Enter onu çağırır. */
function openModal({ title, body, actions, className = '', wide = false, onEnter = null }) {
    closeActiveModal();
    const previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box${wide ? ' modal-wide' : ''} ${className}" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            <div class="modal-header">
                <h3 id="schedule-modal-title">${escapeHtml(title)}</h3>
                <button type="button" class="modal-close" title="Kapat" aria-label="Kapat">${icon('x', 16)}</button>
            </div>
            ${body}
            <div class="modal-actions schedule-modal-actions">${actions}</div>
        </div>
    `;

    const handle = { overlay, close };

    function onKey(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        const target = e.target;
        const isTextInput = target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search');
        if (e.key === 'Enter' && onEnter && isTextInput && overlay.contains(target)) {
            e.preventDefault();
            onEnter();
            return;
        }
        // Pencere açıkken sayfa kısayolları (1-7) çalışmasın
        if (/^[1-9]$/.test(e.key) && !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            e.stopPropagation();
        }
    }

    function close() {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (activeModal === handle) activeModal = null;
        if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
    }

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-modal-cancel]').forEach(btn => btn.addEventListener('click', close));
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(overlay);
    activeModal = handle;
    return handle;
}

function confirmAction({ title, message, confirmLabel, onConfirm }) {
    const modal = openModal({
        title,
        className: 'schedule-confirm-modal',
        body: `<p class="schedule-modal-text">${escapeHtml(message)}</p>`,
        actions: `
            <button type="button" class="modal-btn-cancel" data-modal-cancel>Vazgeç</button>
            <button type="button" class="btn btn-danger schedule-confirm-btn">${escapeHtml(confirmLabel)}</button>
        `,
    });
    const btn = modal.overlay.querySelector('.schedule-confirm-btn');
    btn.addEventListener('click', () => {
        modal.close();
        onConfirm();
    });
    btn.focus();
}

/* Kategori eşleştirme */
function mappingRow(activity, selectedId) {
    const cat = store.categories.find(c => c.id === selectedId);
    const color = safeColor(cat?.color);
    return `
        <div class="schedule-map-row">
            <span class="schedule-dot"${color ? ` style="background:${escapeAttr(color)}"` : ''}></span>
            <span class="schedule-map-name">${escapeHtml(activity)}</span>
            <select class="select schedule-map-select" data-activity="${escapeAttr(activity)}" aria-label="${escapeAttr(activity)} için kategori">
                ${categoryOptions(selectedId)}
            </select>
        </div>
    `;
}

function showCategoryMappingModal(activities, entries) {
    const existingMappings = store.categoryMappings;
    const categoryIds = new Set(store.categories.map(c => c.id));
    const fallback = defaultCategoryId();

    const newActivities = activities.filter(a => !existingMappings[a]);
    const mappedActivities = activities.filter(a => existingMappings[a]);

    const body = `
        <p class="schedule-modal-text">Her ders için bir kategori seçin. Seçimler sonraki içe aktarmalarda hatırlanır.</p>
        ${newActivities.length > 0 ? `
            <div class="schedule-map-list">
                ${newActivities.map(a => mappingRow(a, fallback)).join('')}
            </div>` : `
            <p class="schedule-map-done">${icon('check', 16)}<span>Tüm dersler daha önce eşleştirildi.</span></p>`}
        ${mappedActivities.length > 0 ? `
            <details class="schedule-map-existing"${newActivities.length === 0 ? ' open' : ''}>
                <summary>Önceki eşleştirmeler (${mappedActivities.length})</summary>
                <div class="schedule-map-list">
                    ${mappedActivities.map(a => mappingRow(a, categoryIds.has(existingMappings[a]) ? existingMappings[a] : fallback)).join('')}
                </div>
            </details>` : ''}
    `;

    const modal = openModal({
        title: 'Kategorileri eşleştir',
        wide: true,
        className: 'schedule-mapping-modal',
        body,
        actions: `
            <button type="button" class="modal-btn-cancel" data-modal-cancel>İptal</button>
            <button type="button" class="modal-btn-save" id="btn-save-mappings">Kaydet ve içe aktar</button>
        `,
    });
    const { overlay } = modal;

    // Seçilen kategorinin rengini satırdaki noktaya yansıt
    overlay.querySelectorAll('.schedule-map-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const color = safeColor(store.categories.find(c => c.id === sel.value)?.color);
            const dot = sel.closest('.schedule-map-row').querySelector('.schedule-dot');
            dot.style.background = color;
        });
    });

    overlay.querySelector('#btn-save-mappings').addEventListener('click', () => {
        const newMappings = {};
        overlay.querySelectorAll('.schedule-map-select').forEach(sel => {
            newMappings[sel.dataset.activity] = sel.value;
        });
        const allMappings = { ...existingMappings, ...newMappings };
        entries.forEach(e => { e.category = allMappings[e.activity] || fallback; });

        modal.close();
        store.setCategoryMappings(allMappings);
        store.setWeeklySchedule(entries); // schedule-changed sayfayı yeniden çizer
        showToast(`${entries.length} ders içe aktarıldı`, 'success');
    });
}

/* Haftalık tablo */
function renderTimetable(page) {
    const schedule = store.weeklySchedule;
    const categories = store.categories;
    const todayName = getTodayName();

    const times = [...new Set(schedule.map(e => e.time))].sort((a, b) => parseTimeStart(a) - parseTimeStart(b));
    // Hafta içi her zaman, hafta sonu yalnızca dersi varsa
    const days = DAY_NAMES.filter(d => WEEKDAYS.includes(d) || schedule.some(e => e.day === d));
    const hiddenCount = schedule.filter(e => !DAY_NAMES.includes(e.day)).length;
    const visibleCount = schedule.length - hiddenCount;
    const activeDays = days.filter(d => schedule.some(e => e.day === d)).length;

    const toolbar = document.createElement('div');
    toolbar.className = 'schedule-toolbar';
    toolbar.innerHTML = `
        <p class="section-hint schedule-summary">${visibleCount} ders, ${activeDays} gün</p>
        <div class="schedule-toolbar-actions">
            <button type="button" class="btn btn-sm btn-ghost btn-danger" id="btn-clear-schedule">${icon('trash', 16)}<span>Programı temizle</span></button>
            <button type="button" class="btn btn-sm" id="btn-reimport">${icon('upload', 16)}<span>Yeniden içe aktar</span></button>
            <button type="button" class="btn btn-sm btn-primary" id="btn-add-entry">${icon('plus', 16)}<span>Ders ekle</span></button>
        </div>
    `;
    page.appendChild(toolbar);

    const scroller = document.createElement('div');
    scroller.className = 'schedule-scroll';

    const grid = document.createElement('div');
    grid.className = 'schedule-grid';
    grid.style.gridTemplateColumns = `var(--schedule-time-col) repeat(${days.length}, minmax(var(--schedule-day-col), 1fr))`;
    grid.setAttribute('aria-label', 'Haftalık ders programı');
    grid.setAttribute('role', 'group');

    let html = `<div class="schedule-corner">Saat</div>`;
    days.forEach(day => {
        const isToday = day === todayName;
        const count = schedule.filter(e => e.day === day).length;
        const label = isToday ? 'Bugünün derslerini görev listesine ekle' : `${day} derslerini bugünün listesine ekle`;
        html += `
            <div class="schedule-day${isToday ? ' is-today' : ''}">
                <div class="schedule-day-text">
                    <span class="schedule-day-name">${day}</span>
                    ${isToday ? '<span class="schedule-day-note">Bugün</span>' : ''}
                </div>
                <button type="button" class="icon-btn schedule-transfer" data-day="${day}"
                    title="${label}" aria-label="${label}"${count === 0 ? ' disabled' : ''}>${icon('calendar-check', 16)}</button>
            </div>
        `;
    });

    times.forEach(time => {
        const range = String(time).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
        const timeHtml = range
            ? `<span>${escapeHtml(range[1])}</span><span class="schedule-time-end">${escapeHtml(range[2])}</span>`
            : `<span>${escapeHtml(time)}</span>`;
        html += `<div class="schedule-time">${timeHtml}</div>`;

        days.forEach(day => {
            const isToday = day === todayName;
            const entry = schedule.find(e => e.time === time && e.day === day);
            if (entry) {
                const cat = categories.find(c => c.id === entry.category);
                const color = safeColor(cat?.color);
                const pLabel = PRIORITY_LABELS[entry.priority] || PRIORITY_LABELS.medium;
                const catLabel = cat ? cat.label : entry.category;
                const title = `${entry.activity} — ${catLabel}, ${pLabel}. Düzenlemek için tıklayın`;
                html += `
                    <button type="button" class="schedule-entry${isToday ? ' is-today' : ''}"
                        data-id="${escapeAttr(entry.id)}" title="${escapeAttr(title)}">
                        <span class="schedule-marker"${color ? ` style="background:${escapeAttr(color)}"` : ''}></span>
                        <span class="schedule-entry-name">${escapeHtml(entry.activity)}</span>
                        <span class="schedule-entry-meta">${pLabel}</span>
                    </button>
                `;
            } else {
                const label = `${day} ${time} için ders ekle`;
                html += `
                    <button type="button" class="schedule-slot${isToday ? ' is-today' : ''}"
                        data-day="${day}" data-time="${escapeAttr(time)}"
                        title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">${icon('plus', 14)}</button>
                `;
            }
        });
    });

    grid.innerHTML = html;
    grid.style.minWidth = `calc(var(--schedule-time-col) + ${days.length} * var(--schedule-day-col))`;
    scroller.appendChild(grid);
    page.appendChild(scroller);

    if (hiddenCount > 0) {
        const note = document.createElement('p');
        note.className = 'section-hint schedule-note';
        note.textContent = `${hiddenCount} ders tanınmayan gün adı nedeniyle tabloda gösterilmiyor.`;
        page.appendChild(note);
    }

    grid.addEventListener('click', (e) => {
        const transfer = e.target.closest('.schedule-transfer');
        if (transfer) {
            const day = transfer.dataset.day;
            const added = store.transferDayToDaily(day);
            if (added > 0) {
                showToast(`${day}: ${added} ders bugünün listesine eklendi`, 'success');
            } else {
                showToast(`${day} dersleri zaten listede`, 'info');
            }
            return;
        }
        const entryBtn = e.target.closest('.schedule-entry');
        if (entryBtn) {
            const entry = store.weeklySchedule.find(x => x.id === entryBtn.dataset.id);
            if (entry) showEntryModal({ entry });
            return;
        }
        const slot = e.target.closest('.schedule-slot');
        if (slot) showEntryModal({ day: slot.dataset.day, time: slot.dataset.time });
    });

    toolbar.querySelector('#btn-add-entry').addEventListener('click', () => {
        showEntryModal({ day: days.includes(todayName) ? todayName : days[0] });
    });

    toolbar.querySelector('#btn-clear-schedule').addEventListener('click', () => {
        confirmAction({
            title: 'Programı temizle',
            message: 'Tüm dersler silinecek. Kategori eşleştirmeleri korunur. Bu işlem geri alınamaz.',
            confirmLabel: 'Temizle',
            onConfirm: () => {
                store.clearWeeklySchedule();
                showToast('Ders programı temizlendi', 'delete');
            },
        });
    });

    toolbar.querySelector('#btn-reimport').addEventListener('click', () => {
        confirmAction({
            title: 'Yeniden içe aktar',
            message: 'Mevcut program silinip içe aktarma ekranı açılacak. Dersler metin olarak kutuya yazılır; zorluk seçimleri sıfırlanır.',
            confirmLabel: 'Devam et',
            onConfirm: () => {
                pendingCsv = scheduleToCSV(store.weeklySchedule);
                store.clearWeeklySchedule();
            },
        });
    });
}

/* Ders ekleme ve düzenleme penceresi */
function showEntryModal({ entry = null, day = 'Pazartesi', time = '' } = {}) {
    const isEdit = !!entry;
    const priority = entry?.priority && PRIORITY_LABELS[entry.priority] ? entry.priority : 'medium';
    const selectedCategory = entry
        ? entry.category
        : defaultCategoryId();

    const whenFields = isEdit
        ? `
            <div class="field">
                <span class="field-label">Gün ve saat</span>
                <span class="schedule-readonly">${escapeHtml(entry.day)}, ${escapeHtml(entry.time)}</span>
            </div>`
        : `
            <div class="schedule-form-row">
                <div class="field">
                    <label class="field-label" for="entry-day">Gün</label>
                    <select class="select" id="entry-day">
                        ${DAY_NAMES.map(d => `<option value="${d}"${d === day ? ' selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="entry-time">Saat aralığı</label>
                    <input type="text" class="input" id="entry-time" value="${escapeAttr(time)}"
                        placeholder="08:30 - 09:20" autocomplete="off" inputmode="numeric" />
                </div>
            </div>`;

    const body = `
        <div class="schedule-form">
            ${whenFields}
            <div class="field">
                <label class="field-label" for="entry-activity">Ders adı</label>
                <input type="text" class="input" id="entry-activity" value="${escapeAttr(entry?.activity || '')}"
                    placeholder="Örn. Matematik" autocomplete="off" maxlength="120" />
            </div>
            <div class="field">
                <label class="field-label" for="entry-category">Kategori</label>
                <select class="select" id="entry-category">${categoryOptions(selectedCategory)}</select>
            </div>
            <div class="field">
                <span class="field-label" id="entry-priority-label">Zorluk</span>
                <div class="segmented schedule-priority" role="radiogroup" aria-labelledby="entry-priority-label">
                    ${Object.entries(PRIORITY_LABELS).map(([value, label]) => `
                        <button type="button" role="radio" data-value="${value}"
                            class="${value === priority ? 'active' : ''}" aria-checked="${value === priority}">${label}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    const actions = `
        ${isEdit ? `<button type="button" class="btn btn-ghost btn-danger schedule-delete" id="btn-delete-entry">${icon('trash', 16)}<span>Sil</span></button>` : ''}
        <span class="schedule-actions-spacer"></span>
        <button type="button" class="modal-btn-cancel" data-modal-cancel>İptal</button>
        <button type="button" class="modal-btn-save" id="btn-save-entry">${isEdit ? 'Kaydet' : 'Ekle'}</button>
    `;

    const modal = openModal({
        title: isEdit ? 'Dersi düzenle' : 'Ders ekle',
        className: 'schedule-entry-modal',
        body,
        actions,
        onEnter: () => save(),
    });
    const { overlay } = modal;

    let selectedPriority = priority;
    overlay.querySelectorAll('.schedule-priority button').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.schedule-priority button').forEach(b => {
                b.classList.toggle('active', b === btn);
                b.setAttribute('aria-checked', String(b === btn));
            });
            selectedPriority = btn.dataset.value;
        });
    });

    const activityInput = overlay.querySelector('#entry-activity');
    const timeInput = overlay.querySelector('#entry-time');

    function save() {
        const activity = activityInput.value.trim();
        const category = overlay.querySelector('#entry-category').value;

        if (isEdit) {
            if (!activity) { showToast('Ders adı boş olamaz', 'warning'); activityInput.focus(); return; }
            const current = store.weeklySchedule.find(e => e.id === entry.id);
            if (!current) {
                modal.close();
                showToast('Bu ders artık programda yok', 'warning');
                return;
            }
            const unchanged = current.activity === activity && current.category === category
                && (current.priority || 'medium') === selectedPriority;
            modal.close();
            if (unchanged) return;
            store.updateScheduleEntry(entry.id, { activity, category, priority: selectedPriority });
            showToast('Ders güncellendi', 'success');
            return;
        }

        const dayValue = overlay.querySelector('#entry-day').value;
        const normalized = normalizeTimeRange(timeInput.value);
        if (!normalized) {
            showToast('Saat aralığını 08:30 - 09:20 biçiminde yazın', 'warning');
            timeInput.focus();
            return;
        }
        if (!activity) { showToast('Ders adını yazın', 'warning'); activityInput.focus(); return; }

        const schedule = store.weeklySchedule;
        // Tablodaki satırla eşleşsin diye var olan yazımı kullan
        const existingTime = [...new Set(schedule.map(e => e.time))]
            .find(t => normalizeTimeRange(t) === normalized);
        const finalTime = existingTime || normalized;

        if (schedule.some(e => e.day === dayValue && e.time === finalTime)) {
            showToast(`${dayValue} ${finalTime} saatinde zaten bir ders var`, 'warning');
            return;
        }

        const newEntry = {
            id: generateId(),
            time: finalTime,
            day: dayValue,
            activity,
            category,
            priority: selectedPriority,
        };
        modal.close();
        store.setWeeklySchedule([...schedule, newEntry]);
        showToast('Ders eklendi', 'success');
    }

    overlay.querySelector('#btn-save-entry').addEventListener('click', save);

    overlay.querySelector('#btn-delete-entry')?.addEventListener('click', () => {
        modal.close();
        store.setWeeklySchedule(store.weeklySchedule.filter(e => e.id !== entry.id));
        showToast('Ders silindi', 'delete');
    });

    if (isEdit || !timeInput || time) activityInput.focus();
    else timeInput.focus();
}

/* Yardımcılar */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
