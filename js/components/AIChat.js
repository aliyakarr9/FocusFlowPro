import store from '../store.js';
import { icon } from '../utils/icons.js';

const HISTORY_KEY = 'focusflow-chat';
const MAX_HISTORY = 40;

const SUGGESTIONS = [
    'Bugün neye odaklanmalıyım?',
    'Geciken görevlerimi listele',
    'Yarına "Rapor taslağını yaz" görevi ekle',
    'Tamamlanan görevleri temizle',
];

// Uygulanmadan önce kullanıcıya sorulan eylemler
const DESTRUCTIVE = new Set(['deleteTask', 'clearCompleted', 'deleteHabit', 'deleteCategory', 'deleteScheduleEntry', 'clearWeeklySchedule']);

const PRIORITY_LABELS = { low: 'kolay', medium: 'orta', high: 'zor' };
const LIST_LABELS = { daily: 'Bugün', weekly: 'Haftalık' };
const RECURRENCE_LABELS = { none: 'tekrar yok', daily: 'her gün', weekdays: 'hafta içi', weekly: 'her hafta' };
const THEME_LABELS = { light: 'açık', dark: 'koyu', system: 'sistem' };
const ACCENT_LABELS = { tomato: 'domates', forest: 'orman', ocean: 'okyanus', amber: 'kehribar', rose: 'gül', graphite: 'grafit' };
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

let els = null;
let history = loadHistory();
let pending = false;

/* Geçmiş */

function loadHistory() {
    try {
        const raw = sessionStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(m => m && typeof m.text === 'string') : [];
    } catch (e) {
        return [];
    }
}

function saveHistory() {
    try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) { /* depolama kapalıysa geçmiş yalnızca bellekte kalır */ }
}

/* Yardımcılar */

function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

function quote(text) {
    return `“${String(text ?? '').trim()}”`;
}

function findTask(id) { return store.tasks.find(t => t.id === id); }
function findHabit(id) { return store.habits.find(h => h.id === id); }
function findEntry(id) { return store.weeklySchedule.find(e => e.id === id); }

function validCategory(value) {
    if (!value) return null;
    const wanted = String(value).trim().toLocaleLowerCase('tr');
    const match = store.categories.find(c => c.id.toLocaleLowerCase('tr') === wanted || String(c.label).toLocaleLowerCase('tr') === wanted);
    return match ? match.id : null;
}

function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function validDay(value) {
    if (!value) return null;
    const wanted = String(value).trim().toLocaleLowerCase('tr');
    return DAYS.find(d => d.toLocaleLowerCase('tr') === wanted) || null;
}

/* Modelden gelen görev alanlarını uygulamanın kabul ettiği değerlere indirger. */
function cleanTaskFields(raw = {}) {
    const out = {};
    if (typeof raw.title === 'string' && raw.title.trim()) out.title = raw.title.trim();
    const cat = validCategory(raw.category);
    if (cat) out.category = cat;
    if (['low', 'medium', 'high'].includes(raw.priority)) out.priority = raw.priority;
    if (raw.dueDate === '' || raw.dueDate === null) out.dueDate = '';
    else if (validDate(raw.dueDate)) out.dueDate = raw.dueDate;
    if (['daily', 'weekly'].includes(raw.list)) out.list = raw.list;
    if (['none', 'daily', 'weekdays', 'weekly'].includes(raw.recurrence)) out.recurrence = raw.recurrence;
    if (typeof raw.notes === 'string') out.notes = raw.notes;
    return out;
}

/* Eylemler: describe() kullanıcıya gösterilecek cümleyi döndürür (null ise eylem geçersizdir ve atlanır), run() uygular. */

const ACTIONS = {
    addTask: {
        describe(p) {
            const f = cleanTaskFields(p);
            if (!f.title) return null;
            const bits = [LIST_LABELS[f.list || 'daily']];
            if (f.dueDate) bits.push(formatDate(f.dueDate));
            if (f.priority) bits.push(PRIORITY_LABELS[f.priority]);
            if (f.category) bits.push(f.category);
            return `Görev eklendi: ${quote(f.title)} (${bits.join(', ')})`;
        },
        run(p) {
            const f = cleanTaskFields(p);
            const task = store.addTask({
                title: f.title,
                category: f.category || validCategory('Genel') || store.categories[0]?.id || 'Genel',
                priority: f.priority || 'medium',
                dueDate: f.dueDate || '',
                list: f.list || 'daily',
                notes: f.notes || '',
                recurrence: f.recurrence || 'none',
            });
            if (task && Array.isArray(p.subtasks)) {
                p.subtasks.filter(s => typeof s === 'string' && s.trim()).slice(0, 20).forEach(s => store.addSubtask(task.id, s));
            }
        },
    },
    updateTask: {
        describe(p) {
            const task = findTask(p?.id);
            const f = cleanTaskFields(p?.updates);
            if (!task || Object.keys(f).length === 0) return null;
            const bits = [];
            if (f.title) bits.push(`ad ${quote(f.title)}`);
            if ('dueDate' in f) bits.push(f.dueDate ? `son teslim ${formatDate(f.dueDate)}` : 'son teslim kaldırıldı');
            if (f.priority) bits.push(`zorluk ${PRIORITY_LABELS[f.priority]}`);
            if (f.category) bits.push(`kategori ${f.category}`);
            if (f.list) bits.push(`liste ${LIST_LABELS[f.list]}`);
            if (f.recurrence) bits.push(RECURRENCE_LABELS[f.recurrence]);
            if ('notes' in f) bits.push('not güncellendi');
            return `Görev güncellendi: ${quote(task.title)} (${bits.join(', ')})`;
        },
        run(p) { store.updateTask(p.id, cleanTaskFields(p.updates)); },
    },
    completeTask: {
        describe(p) {
            const task = findTask(p?.id);
            if (!task) return null;
            const done = p.completed !== false;
            if (task.completed === done) return null;
            return done ? `Tamamlandı: ${quote(task.title)}` : `Yeniden açıldı: ${quote(task.title)}`;
        },
        run(p) { store.setTaskCompleted(p.id, p.completed !== false); },
    },
    deleteTask: {
        describe(p) {
            const task = findTask(p?.id);
            return task ? `Görev silinsin: ${quote(task.title)}` : null;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run(p) { store.deleteTask(p.id); },
    },
    addSubtask: {
        describe(p) {
            const task = findTask(p?.id);
            if (!task || typeof p.title !== 'string' || !p.title.trim()) return null;
            return `Alt görev eklendi: ${quote(p.title)} → ${quote(task.title)}`;
        },
        run(p) { store.addSubtask(p.id, p.title); },
    },
    moveToDaily: {
        describe(p) {
            const task = findTask(p?.id);
            if (!task || task.list !== 'weekly') return null;
            if (store.tasks.some(t => t.list === 'daily' && t.sourceId === task.id)) return null;
            return `Bugüne eklendi: ${quote(task.title)}`;
        },
        run(p) { store.moveToDaily(p.id); },
    },
    clearCompleted: {
        describe(p) {
            const list = p?.list === 'weekly' ? 'weekly' : 'daily';
            const count = store.getTasksByList(list).filter(t => t.completed).length;
            return count > 0 ? `${LIST_LABELS[list]} listesindeki ${count} tamamlanmış görev silinsin` : null;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run(p) { store.clearCompleted(p?.list === 'weekly' ? 'weekly' : 'daily'); },
    },
    addHabit: {
        describe(p) {
            const name = typeof p === 'string' ? p : p?.name;
            return typeof name === 'string' && name.trim() ? `Alışkanlık eklendi: ${quote(name)}` : null;
        },
        run(p) { store.addHabit(typeof p === 'string' ? p : p.name, 'target'); },
    },
    deleteHabit: {
        describe(p) {
            const habit = findHabit(p?.id);
            return habit ? `Alışkanlık ve geçmişi silinsin: ${quote(habit.name)}` : null;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run(p) { store.deleteHabit(p.id); },
    },
    addCategory: {
        describe(p) {
            const label = typeof p?.label === 'string' ? p.label.trim() : '';
            if (!label || validCategory(label)) return null;
            return `Kategori eklendi: ${quote(label)}`;
        },
        run(p) {
            const color = /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : '#64748b';
            store.addCategory(p.label.trim().slice(0, 20), typeof p.icon === 'string' && p.icon ? p.icon : '📌', color);
        },
    },
    deleteCategory: {
        describe(p) {
            const id = validCategory(p?.id);
            if (!id || store.categories.length <= 1) return null;
            const count = store.tasks.filter(t => t.category === id).length;
            return `Kategori silinsin: ${quote(id)}${count ? ` (${count} görev başka kategoriye taşınır)` : ''}`;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run(p) { store.deleteCategory(validCategory(p.id)); },
    },
    addScheduleEntry: {
        describe(p) {
            const day = validDay(p?.day);
            if (!day || typeof p.activity !== 'string' || !p.activity.trim() || !/\d{1,2}[:.]\d{2}/.test(String(p.time || ''))) return null;
            return `Programa eklendi: ${day} ${String(p.time).trim()}, ${quote(p.activity)}`;
        },
        run(p) {
            store.addScheduleEntry({
                day: validDay(p.day),
                time: String(p.time).trim(),
                activity: p.activity,
                category: validCategory(p.category) || undefined,
                priority: p.priority,
            });
        },
    },
    updateSchedule: {
        describe(p) {
            const entry = findEntry(p?.id);
            const u = p?.updates || {};
            if (!entry) return null;
            const bits = [];
            if (typeof u.activity === 'string' && u.activity.trim()) bits.push(`ad ${quote(u.activity)}`);
            if (validCategory(u.category)) bits.push(`kategori ${validCategory(u.category)}`);
            if (PRIORITY_LABELS[u.priority]) bits.push(`zorluk ${PRIORITY_LABELS[u.priority]}`);
            if (bits.length === 0) return null;
            return `Program güncellendi: ${entry.day} ${entry.time} (${bits.join(', ')})`;
        },
        run(p) {
            const u = { ...p.updates };
            if (u.category) u.category = validCategory(u.category);
            store.updateScheduleEntry(p.id, u);
        },
    },
    deleteScheduleEntry: {
        describe(p) {
            const entry = findEntry(p?.id);
            return entry ? `Programdan silinsin: ${entry.day} ${entry.time}, ${quote(entry.activity)}` : null;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run(p) { store.deleteScheduleEntry(p.id); },
    },
    clearWeeklySchedule: {
        describe() {
            const count = store.weeklySchedule.length;
            return count > 0 ? `Ders programının tamamı silinsin (${count} girdi)` : null;
        },
        done(p, label) { return label.replace('silinsin', 'silindi'); },
        run() { store.clearWeeklySchedule(); },
    },
    setTheme: {
        describe(p) {
            const bits = [];
            if (THEME_LABELS[p?.theme] && p.theme !== store.theme) bits.push(`tema ${THEME_LABELS[p.theme]}`);
            if (ACCENT_LABELS[p?.accent] && p.accent !== store.accent) bits.push(`vurgu rengi ${ACCENT_LABELS[p.accent]}`);
            return bits.length ? `Görünüm değişti: ${bits.join(', ')}` : null;
        },
        run(p) {
            if (THEME_LABELS[p.theme]) store.setTheme(p.theme);
            if (ACCENT_LABELS[p.accent]) store.setAccent(p.accent);
        },
    },
};

/* Geçerli eylemleri açıklamalarıyla birlikte döndürür. */
function prepareActions(actions) {
    const prepared = [];
    (Array.isArray(actions) ? actions : []).forEach(action => {
        const def = ACTIONS[action?.type];
        if (!def) return;
        let label = null;
        try { label = def.describe(action.payload); } catch (e) { label = null; }
        if (label) prepared.push({ ...action, def, label, destructive: DESTRUCTIVE.has(action.type) });
    });
    return prepared;
}

function runActions(prepared) {
    const applied = [];
    prepared.forEach(a => {
        try {
            a.def.run(a.payload);
            applied.push(a.def.done ? a.def.done(a.payload, a.label) : a.label);
        } catch (e) {
            console.error('Asistan eylemi uygulanamadı:', a.type, e);
        }
    });
    return applied;
}

/* Arayüz */

function scrollToEnd() {
    els.messages.scrollTop = els.messages.scrollHeight;
}

function addBubble(text, role) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    div.textContent = text;
    els.messages.appendChild(div);
    scrollToEnd();
    return div;
}

/* Uygulanan eylemleri ve "Geri al" düğmesini gösterir. */
function addAppliedCard(labels, snapshot) {
    if (labels.length === 0) return;
    const card = document.createElement('div');
    card.className = 'chat-card';
    const list = document.createElement('ul');
    list.className = 'chat-action-list';
    labels.forEach(label => {
        const li = document.createElement('li');
        li.innerHTML = icon('check', 14);
        const span = document.createElement('span');
        span.textContent = label;
        li.appendChild(span);
        list.appendChild(li);
    });
    card.appendChild(list);

    // Geri alma, uygulamadan önceki duruma döner. Arada başka değişiklik yapıldıysa önce sorulur.
    const after = store.snapshot();
    const undo = document.createElement('button');
    undo.className = 'btn btn-sm btn-ghost chat-undo';
    undo.innerHTML = `${icon('undo', 14)}<span>Geri al</span>`;
    undo.addEventListener('click', () => {
        if (store.snapshot() !== after
            && !confirm('Bu işlemden sonra başka değişiklikler yapıldı. Geri alırsan onlar da kaybolur. Devam edilsin mi?')) {
            return;
        }
        if (store.restoreSnapshot(snapshot)) {
            card.classList.add('undone');
            undo.remove();
            const note = document.createElement('div');
            note.className = 'chat-card-note';
            note.textContent = 'Geri alındı.';
            card.appendChild(note);
        }
    });
    card.appendChild(undo);
    els.messages.appendChild(card);
    scrollToEnd();
}

/* Silme gibi eylemler için onay kartı. */
function addConfirmCard(destructive) {
    const card = document.createElement('div');
    card.className = 'chat-card chat-confirm';
    const title = document.createElement('div');
    title.className = 'chat-card-title';
    title.textContent = 'Onayını bekleyen işlemler';
    card.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'chat-action-list';
    destructive.forEach(a => {
        const li = document.createElement('li');
        li.innerHTML = icon('alert', 14);
        const span = document.createElement('span');
        span.textContent = a.label;
        li.appendChild(span);
        list.appendChild(li);
    });
    card.appendChild(list);

    const row = document.createElement('div');
    row.className = 'chat-confirm-actions';
    const apply = document.createElement('button');
    apply.className = 'btn btn-sm btn-primary';
    apply.textContent = 'Uygula';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-sm';
    cancel.textContent = 'Vazgeç';
    row.append(apply, cancel);
    card.appendChild(row);

    const finish = (note) => {
        row.remove();
        const n = document.createElement('div');
        n.className = 'chat-card-note';
        n.textContent = note;
        card.appendChild(n);
        card.classList.remove('chat-confirm');
    };

    apply.addEventListener('click', () => {
        const snapshot = store.snapshot();
        // Onay beklerken veri değişmiş olabilir: yeniden doğrula
        const stillValid = prepareActions(destructive.map(a => ({ type: a.type, payload: a.payload })));
        const applied = runActions(stillValid);
        finish(applied.length ? 'Uygulandı.' : 'Uygulanacak bir şey kalmamış.');
        addAppliedCard(applied, snapshot);
    });
    cancel.addEventListener('click', () => finish('Vazgeçildi, hiçbir şey silinmedi.'));

    els.messages.appendChild(card);
    scrollToEnd();
}

function renderSuggestions() {
    els.suggestions.innerHTML = '';
    if (history.length > 0) return;
    SUGGESTIONS.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'chat-suggestion';
        btn.textContent = text;
        btn.addEventListener('click', () => send(text));
        els.suggestions.appendChild(btn);
    });
}

function renderHistory() {
    els.messages.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'chat-intro';
    intro.textContent = 'Görevlerini, alışkanlıklarını ve ders programını yazarak yönetebilirsin. Silme işlemlerinde önce sana sorarım; yaptığım her değişikliği geri alabilirsin.';
    els.messages.appendChild(intro);
    history.forEach(m => addBubble(m.text, m.role === 'user' ? 'user' : 'ai'));
    renderSuggestions();
}

function setPending(value) {
    pending = value;
    els.send.disabled = value;
    els.input.disabled = value;
    if (!value) els.input.focus();
}

async function send(text) {
    const message = (text ?? els.input.value).trim();
    if (!message || pending) return;

    els.input.value = '';
    els.suggestions.innerHTML = '';
    addBubble(message, 'user');
    const previous = history.slice(-10);
    history.push({ role: 'user', text: message });
    saveHistory();

    setPending(true);
    const loading = addBubble('Yazıyor…', 'ai');
    loading.classList.add('chat-loading');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, state: store.state, history: previous }),
        });
        const data = await response.json();
        loading.remove();

        const reply = data.message || data.error || 'Yanıt alınamadı.';
        addBubble(reply, response.ok && !data.error ? 'ai' : 'error');
        if (response.ok && data.message) {
            history.push({ role: 'assistant', text: data.message });
            saveHistory();
        }

        const prepared = prepareActions(data.actions);
        const safe = prepared.filter(a => !a.destructive);
        const destructive = prepared.filter(a => a.destructive);

        if (safe.length > 0) {
            const snapshot = store.snapshot();
            addAppliedCard(runActions(safe), snapshot);
        }
        if (destructive.length > 0) addConfirmCard(destructive);
    } catch (err) {
        loading.remove();
        addBubble('Asistana ulaşılamadı. Bağlantını kontrol edip yeniden dene.', 'error');
    } finally {
        setPending(false);
    }
}

/* Dışa açılanlar */

export function isAIChatOpen() {
    return !!els && !els.window.classList.contains('hidden');
}

export function openAIChat() {
    if (!els) return;
    els.window.classList.remove('hidden');
    els.button.setAttribute('aria-expanded', 'true');
    scrollToEnd();
    els.input.focus();
}

export function closeAIChat() {
    if (!els) return;
    els.window.classList.add('hidden');
    els.button.setAttribute('aria-expanded', 'false');
}

export function toggleAIChat() {
    if (isAIChatOpen()) closeAIChat(); else openAIChat();
}

export function renderAIChatWidget() {
    const container = document.createElement('div');
    container.id = 'ai-chat-container';
    container.className = 'ai-chat-container';
    container.innerHTML = `
        <div id="ai-chat-window" class="ai-chat-window hidden" role="dialog" aria-label="Asistan">
            <div class="ai-chat-header">
                <h3>Asistan</h3>
                <div class="ai-chat-header-actions">
                    <button id="ai-chat-clear" class="icon-btn" title="Konuşmayı temizle" aria-label="Konuşmayı temizle">${icon('reset', 16)}</button>
                    <button id="ai-chat-close" class="icon-btn" title="Kapat (Esc)" aria-label="Kapat">${icon('x', 16)}</button>
                </div>
            </div>
            <div id="ai-chat-messages" class="ai-chat-messages" aria-live="polite"></div>
            <div id="ai-chat-suggestions" class="chat-suggestions"></div>
            <form id="ai-chat-form" class="ai-chat-input-area">
                <input type="text" id="ai-chat-input" placeholder="Ne yapmamı istersin?" autocomplete="off" aria-label="Asistana mesaj" />
                <button type="submit" id="ai-chat-send" class="chat-send" title="Gönder" aria-label="Gönder">${icon('send', 16)}</button>
            </form>
        </div>
        <button id="ai-chat-btn" class="ai-chat-btn" title="Asistan" aria-label="Asistan" aria-expanded="false">
            ${icon('chat', 22)}
        </button>
    `;
    document.body.appendChild(container);

    els = {
        window: container.querySelector('#ai-chat-window'),
        button: container.querySelector('#ai-chat-btn'),
        messages: container.querySelector('#ai-chat-messages'),
        suggestions: container.querySelector('#ai-chat-suggestions'),
        input: container.querySelector('#ai-chat-input'),
        send: container.querySelector('#ai-chat-send'),
    };

    els.button.addEventListener('click', toggleAIChat);
    container.querySelector('#ai-chat-close').addEventListener('click', closeAIChat);
    container.querySelector('#ai-chat-clear').addEventListener('click', () => {
        history = [];
        saveHistory();
        renderHistory();
        els.input.focus();
    });
    container.querySelector('#ai-chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        send();
    });

    renderHistory();
}
