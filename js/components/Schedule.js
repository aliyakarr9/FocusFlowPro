/* ============================================
   FocusFlow Pro — Schedule Import Component
   CSV-based weekly timetable with category
   mapping and day-to-daily transfer.
   ============================================ */

import store from '../store.js';
import { showToast } from './TaskCard.js';
import { generateId } from '../utils/helpers.js';

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const PRIORITY_LABELS = { low: 'Kolay', medium: 'Orta', high: 'Zor' };

function getTodayName() {
    const jsDay = new Date().getDay(); // 0=Sun
    return DAY_NAMES[jsDay === 0 ? 6 : jsDay - 1];
}

/* Sort time strings like "08:30 - 09:20" ascending */
function parseTimeStart(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 9999;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/* ---------- Main render ---------- */
export function renderSchedule(container) {
    container.innerHTML = '';
    const schedule = store.weeklySchedule;

    if (schedule.length === 0) {
        renderImportView(container);
    } else {
        renderTimetable(container);
    }
}

/* ---------- Import View ---------- */
function renderImportView(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'schedule-import-wrapper';
    wrapper.innerHTML = `
        <div class="schedule-import-card">
            <div class="schedule-import-header">
                <span class="schedule-import-icon">📋</span>
                <h3>Haftalık Ders Programı İçe Aktar</h3>
                <p>CSV formatında ders programınızı aşağıya yapıştırın.<br>
                İlk satır başlıkları (Saat, Pazartesi, Salı...) içermeli.</p>
            </div>
            <textarea class="schedule-textarea" id="schedule-csv" rows="12"
                placeholder="Saat,Pazartesi,Salı,Çarşamba,Perşembe,Cuma,Cumartesi,Pazar
08:30 - 09:20,📖 MATE134,📖 BTBS243,...
09:30 - 10:20,📖 MATE134,📖 BTBS243,..."></textarea>
            <div class="schedule-import-actions">
                <button class="schedule-btn primary" id="btn-parse-csv">📥 İçe Aktar</button>
            </div>
        </div>
    `;
    container.appendChild(wrapper);

    document.getElementById('btn-parse-csv').addEventListener('click', () => {
        const csv = document.getElementById('schedule-csv').value.trim();
        if (!csv) { showToast('Lütfen CSV verisini yapıştırın', 'warning'); return; }
        const entries = parseCSV(csv);
        if (entries.length === 0) { showToast('Geçerli veri bulunamadı', 'warning'); return; }

        // Find unique activities
        const uniqueActivities = [...new Set(entries.map(e => e.activity))];
        showCategoryMappingModal(uniqueActivities, entries, container);
    });
}

/* ---------- CSV Parser ---------- */
function parseCSV(csv) {
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    const dayColumns = headers.slice(1); // First column is "Saat"

    const entries = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i]);
        const time = cols[0]?.trim();
        if (!time) continue;

        for (let d = 0; d < dayColumns.length; d++) {
            const raw = (cols[d + 1] || '').trim();
            if (!raw) continue;
            const activity = raw;
            entries.push({
                id: generateId(),
                time,
                day: dayColumns[d],
                activity,
                category: 'Genel',
                priority: 'medium',
            });
        }
    }
    return entries;
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

/* ---------- Category Mapping Modal ---------- */
function showCategoryMappingModal(activities, entries, container) {
    document.querySelector('.modal-overlay')?.remove();

    const existingMappings = store.categoryMappings;
    const categories = store.categories;

    const newActivities = activities.filter(a => !existingMappings[a]);
    const mappedActivities = activities.filter(a => existingMappings[a]);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box mapping-modal">
            <div class="modal-header">
                <h3>🏷️ Kategori Eşleştirme</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="mapping-description">
                <p>Her benzersiz aktivite için bir kategori seçin. Bu eşleştirmeler hatırlanacak!</p>
                ${mappedActivities.length > 0 ? `<p class="mapping-info">✅ ${mappedActivities.length} aktivite zaten eşleştirilmiş</p>` : ''}
            </div>
            <div class="mapping-list" id="mapping-list">
                ${newActivities.map(activity => `
                    <div class="mapping-row">
                        <span class="mapping-activity">${escapeHtml(activity)}</span>
                        <select class="mapping-select" data-activity="${escapeAttr(activity)}">
                            ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
                        </select>
                    </div>
                `).join('')}
                ${newActivities.length === 0 ? '<p class="mapping-all-done">✅ Tüm aktiviteler zaten eşleştirilmiş!</p>' : ''}
            </div>
            ${mappedActivities.length > 0 ? `
            <details class="mapping-existing">
                <summary>📋 Mevcut eşleştirmeler (${mappedActivities.length})</summary>
                <div class="mapping-list">
                    ${mappedActivities.map(activity => `
                        <div class="mapping-row mapped">
                            <span class="mapping-activity">${escapeHtml(activity)}</span>
                            <select class="mapping-select" data-activity="${escapeAttr(activity)}">
                                ${categories.map(c => `<option value="${c.id}" ${c.id === existingMappings[activity] ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>
            </details>` : ''}
            <div class="modal-actions">
                <button class="modal-btn-cancel">İptal</button>
                <button class="modal-btn-save" id="btn-save-mappings">💾 Kaydet ve İçe Aktar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.getElementById('btn-save-mappings').addEventListener('click', () => {
        const newMappings = {};
        overlay.querySelectorAll('.mapping-select').forEach(sel => {
            newMappings[sel.dataset.activity] = sel.value;
        });

        const allMappings = { ...existingMappings, ...newMappings };
        store.setCategoryMappings(allMappings);

        entries.forEach(e => { e.category = allMappings[e.activity] || 'Genel'; });
        store.setWeeklySchedule(entries);

        close();
        showToast(`✅ ${entries.length} ders programına aktarıldı!`, 'success');
        renderSchedule(container);
    });
}

/* ---------- Timetable View ---------- */
function renderTimetable(container) {
    const schedule = store.weeklySchedule;
    const categories = store.categories;
    const todayName = getTodayName();

    // Get unique times sorted ascending (earliest first)
    const times = [...new Set(schedule.map(e => e.time))].sort((a, b) => parseTimeStart(a) - parseTimeStart(b));
    const days = DAY_NAMES.filter(d => schedule.some(e => e.day === d));

    const wrapper = document.createElement('div');
    wrapper.className = 'schedule-timetable-wrapper';

    // Header actions
    const headerActions = document.createElement('div');
    headerActions.className = 'schedule-header-actions';
    headerActions.innerHTML = `
        <button class="schedule-btn danger" id="btn-clear-schedule">🗑️ Programı Temizle</button>
        <button class="schedule-btn secondary" id="btn-reimport">📥 Yeniden İçe Aktar</button>
    `;
    wrapper.appendChild(headerActions);

    // Build table
    const table = document.createElement('div');
    table.className = 'schedule-table';
    table.style.gridTemplateColumns = `100px repeat(${days.length}, 1fr)`;

    // Header row
    const cornerCell = document.createElement('div');
    cornerCell.className = 'schedule-cell schedule-corner';
    cornerCell.textContent = '⏰ Saat';
    table.appendChild(cornerCell);

    days.forEach(day => {
        const isToday = day === todayName;
        const header = document.createElement('div');
        header.className = `schedule-cell schedule-day-header${isToday ? ' schedule-today' : ''}`;
        header.innerHTML = `
            <span class="day-name">${day}</span>
            ${isToday ? '<span class="today-badge">Bugün</span>' : ''}
            <button class="schedule-day-transfer-btn${isToday ? ' today' : ''}" data-day="${day}">
                📋 ${isToday ? 'Bugüne Ekle' : 'Günlüğe Aktar'}
            </button>
        `;
        table.appendChild(header);
    });

    // Data rows
    times.forEach(time => {
        const timeCell = document.createElement('div');
        timeCell.className = 'schedule-cell schedule-time';
        timeCell.textContent = time;
        table.appendChild(timeCell);

        days.forEach(day => {
            const entry = schedule.find(e => e.time === time && e.day === day);
            const cell = document.createElement('div');
            cell.className = 'schedule-cell schedule-entry';

            if (entry) {
                const catInfo = categories.find(c => c.id === entry.category);
                const color = catInfo ? catInfo.color : '#64748b';
                cell.style.borderLeftColor = color;
                cell.classList.add('has-entry');
                if (day === todayName) cell.classList.add('schedule-today');

                const pLabel = PRIORITY_LABELS[entry.priority || 'medium'];
                const pClass = entry.priority || 'medium';
                cell.innerHTML = `
                    <div class="entry-content">
                        <span class="entry-text">${escapeHtml(entry.activity)}</span>
                        <span class="entry-priority priority-${pClass}">${pLabel}</span>
                    </div>
                `;
                // Click to edit
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', () => showEditEntryModal(entry, container));
            }
            table.appendChild(cell);
        });
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);

    // Transfer buttons
    wrapper.querySelectorAll('.schedule-day-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const day = btn.dataset.day;
            const added = store.transferDayToDaily(day);
            if (added > 0) {
                showToast(`✅ ${day}: ${added} görev günlüğe eklendi!`, 'success');
            } else {
                showToast(`${day} görevleri zaten ekli veya boş`, 'warning');
            }
        });
    });

    // Header action listeners
    document.getElementById('btn-clear-schedule').addEventListener('click', () => {
        if (confirm('Ders programını silmek istediğinize emin misiniz?')) {
            store.clearWeeklySchedule();
            renderSchedule(container);
            showToast('Ders programı temizlendi', 'info');
        }
    });

    document.getElementById('btn-reimport').addEventListener('click', () => {
        store.clearWeeklySchedule();
        renderSchedule(container);
    });
}

/* ---------- Edit Entry Modal ---------- */
function showEditEntryModal(entry, container) {
    document.querySelector('.modal-overlay')?.remove();
    const categories = store.categories;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box edit-entry-modal">
            <div class="modal-header">
                <h3>✏️ Dersi Düzenle</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="edit-entry-form">
                <div class="edit-field">
                    <label>📅 Gün & Saat</label>
                    <span class="edit-readonly">${entry.day} — ${entry.time}</span>
                </div>
                <div class="edit-field">
                    <label>📝 Aktivite Adı</label>
                    <input type="text" class="edit-input" id="edit-activity" value="${escapeAttr(entry.activity)}" />
                </div>
                <div class="edit-field">
                    <label>🏷️ Kategori</label>
                    <select class="edit-select" id="edit-category">
                        ${categories.map(c => `<option value="${c.id}" ${c.id === entry.category ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
                    </select>
                </div>
                <div class="edit-field">
                    <label>⚡ Zorluk</label>
                    <div class="edit-priority-group" id="edit-priority-group">
                        <button class="edit-priority-btn ${(entry.priority || 'medium') === 'low' ? 'active' : ''}" data-value="low">🟢 Kolay</button>
                        <button class="edit-priority-btn ${(entry.priority || 'medium') === 'medium' ? 'active' : ''}" data-value="medium">🟡 Orta</button>
                        <button class="edit-priority-btn ${(entry.priority || 'medium') === 'high' ? 'active' : ''}" data-value="high">🔴 Zor</button>
                    </div>
                </div>
            </div>
            <div class="modal-actions edit-modal-actions">
                <button class="modal-btn-delete" id="btn-delete-entry">🗑️ Sil</button>
                <div class="edit-modal-right">
                    <button class="modal-btn-cancel">İptal</button>
                    <button class="modal-btn-save" id="btn-save-entry">💾 Kaydet</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let selectedPriority = entry.priority || 'medium';

    // Priority buttons
    overlay.querySelectorAll('.edit-priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.edit-priority-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPriority = btn.dataset.value;
        });
    });

    function close() { overlay.remove(); }
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Save
    document.getElementById('btn-save-entry').addEventListener('click', () => {
        const newActivity = document.getElementById('edit-activity').value.trim();
        const newCategory = document.getElementById('edit-category').value;
        if (!newActivity) { showToast('Aktivite adı boş olamaz', 'warning'); return; }

        const schedule = store.weeklySchedule.map(e => {
            if (e.id === entry.id) {
                return { ...e, activity: newActivity, category: newCategory, priority: selectedPriority };
            }
            return e;
        });
        store.setWeeklySchedule(schedule);
        close();
        showToast('✅ Ders güncellendi', 'success');
        renderSchedule(container);
    });

    // Delete
    document.getElementById('btn-delete-entry').addEventListener('click', () => {
        const schedule = store.weeklySchedule.filter(e => e.id !== entry.id);
        store.setWeeklySchedule(schedule);
        close();
        showToast('Ders silindi', 'info');
        renderSchedule(container);
    });
}

/* ---------- Helpers ---------- */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
